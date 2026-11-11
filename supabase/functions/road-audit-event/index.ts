import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json(401, { error: "AUTH_REQUIRED" });

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return json(503, { error: "SERVER_CONFIGURATION_ERROR" });

  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) return json(401, { error: "INVALID_SESSION" });

  const raw = await req.text();
  if (raw.length > 4096) return json(413, { error: "PAYLOAD_TOO_LARGE" });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid");
  } catch { return json(400, { error: "INVALID_JSON" }); }

  const action = typeof body.action === "string" ? body.action.trim() : "";
  const resourceType = typeof body.resource_type === "string" ? body.resource_type.trim() : null;
  const resourceId = typeof body.resource_id === "string" ? body.resource_id.trim() : null;
  const outcome = body.outcome === "denied" || body.outcome === "failure" ? body.outcome : "success";
  if (!/^[A-Z0-9_.:-]{2,120}$/i.test(action)) return json(400, { error: "INVALID_ACTION" });
  if (resourceType && !/^[A-Z0-9_.:-]{1,60}$/i.test(resourceType)) return json(400, { error: "INVALID_RESOURCE_TYPE" });
  if (resourceId && resourceId.length > 120) return json(400, { error: "INVALID_RESOURCE_ID" });

  const allowedKeys = ["page", "module", "reason", "source", "client_version"];
  const details: Record<string, string> = {};
  if (body.details && typeof body.details === "object" && !Array.isArray(body.details)) {
    for (const key of allowedKeys) {
      const value = (body.details as Record<string, unknown>)[key];
      if (typeof value === "string") details[key] = value.slice(0, 160);
    }
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: roles, error: roleError } = await admin.from("user_roles").select("role").eq("user_id", authData.user.id).limit(10);
  if (roleError) return json(500, { error: "ROLE_LOOKUP_FAILED" });
  const actorRole = roles?.some((row) => row.role === "admin") ? "admin" : "user";
  const { error: insertError } = await admin.from("audit_logs").insert({
    user_id: authData.user.id, actor_role: actorRole, action,
    resource_type: resourceType, resource_id: resourceId, outcome, details,
  });
  if (insertError) return json(500, { error: "AUDIT_WRITE_FAILED" });
  return json(201, { ok: true });
});
