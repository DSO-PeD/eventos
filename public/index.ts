// ============================================================
// EDGE FUNCTION: enviar-email
// Envia o email de agradecimento a quem confirma presença.
// Chamada pelo admin.html via sb.functions.invoke('enviar-email', ...)
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
// Domínio remetente: tem de estar verificado no Resend.
// Enquanto não verificares um domínio próprio, podes usar
// "onboarding@resend.dev" apenas para testes.
const EMAIL_REMETENTE = Deno.env.get("EMAIL_REMETENTE") ?? "onboarding@resend.dev";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatarData(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" }) +
    " às " + d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

function construirEmailHtml(nome: string, eventoNome: string, eventoData: string, eventoLocal: string) {
  return `
  <div style="font-family:Arial,sans-serif;background:#0b1f1c;padding:40px 20px;">
    <div style="max-width:520px;margin:0 auto;background:#12302a;border-radius:16px;padding:36px 32px;border:1px solid #2a4a3f;">
      <p style="color:#c9a24b;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:0 0 10px;">Confirmação Recebida</p>
      <h1 style="color:#f3efe6;font-size:24px;margin:0 0 20px;">Obrigado, ${nome}!</h1>
      <p style="color:#d7d2c6;font-size:15px;line-height:1.6;margin:0 0 18px;">
        A tua presença em <strong style="color:#e4c878;">${eventoNome}</strong> foi confirmada com sucesso.
        Agradecemos muito o teu interesse em participar.
      </p>
      <div style="background:#173a30;border-radius:10px;padding:18px 20px;margin:0 0 20px;">
        <p style="color:#9fb3ac;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Data</p>
        <p style="color:#f3efe6;font-size:14.5px;margin:0 0 14px;">${formatarData(eventoData)}</p>
        <p style="color:#9fb3ac;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Local</p>
        <p style="color:#f3efe6;font-size:14.5px;margin:0;">${eventoLocal}</p>
      </div>
      <p style="color:#9fb3ac;font-size:13px;line-height:1.6;margin:0;">
        Se surgir alguma alteração, entraremos em contacto através deste email.
      </p>
    </div>
  </div>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ sucesso: false, erro: "RESEND_API_KEY não configurada nos secrets da função." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { nome, email, evento_nome, evento_data, evento_local } = await req.json();

    if (!nome || !email) {
      return new Response(
        JSON.stringify({ sucesso: false, erro: "nome e email são obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resposta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Donzimar <${EMAIL_REMETENTE}>`,
        to: [email],
        subject: `Presença confirmada — ${evento_nome}`,
        html: construirEmailHtml(nome, evento_nome, evento_data, evento_local),
      }),
    });

    const resultado = await resposta.json();

    if (!resposta.ok) {
      return new Response(
        JSON.stringify({ sucesso: false, erro: resultado }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ sucesso: true, id: resultado.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ sucesso: false, erro: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
