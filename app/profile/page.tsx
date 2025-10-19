"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

type Profile = {
  id: string;
  name: string | null;
  whatsapp: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  bairro?: string | null;
  city: string | null;
  state?: string | null;
  cep: string | null;
  cpf: string | null;
  status?: "waitlist" | "approved";
};

/* Utils */
function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}
function cepValid(cep: string) {
  return onlyDigits(cep).length === 8;
}
function cpfValid(cpf: string) {
  const s = onlyDigits(cpf);
  if (s.length !== 11) return false;
  if (/^(\d)\1+$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(s[i]) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (d1 !== parseInt(s[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(s[i]) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  return d2 === parseInt(s[10]);
}

// ViaCEP
async function fetchAddress(cep: string) {
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.erro) return null;
    return {
      street: data.logradouro || "",
      neighborhood: data.bairro || "",
      city: data.localidade || "",
      uf: data.uf || "",
    };
  } catch {
    return null;
  }
}

// Cidades IBGE
async function fetchCities(uf: string) {
  try {
    const res = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((c: any) => c.nome) as string[];
  } catch {
    return [];
  }
}

function ProfilePageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const nextRaw = search?.get("next") || "/";

  const next = useMemo(() => {
    try {
      const decoded = decodeURIComponent(nextRaw);
      if (/^https?:\/\//i.test(decoded)) return "/";
      return decoded || "/";
    } catch {
      return "/";
    }
  }, [nextRaw]);

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [stateUf, setStateUf] = useState("SP");
  const [city, setCity] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [cep, setCep] = useState("");
  const [cpf, setCpf] = useState("");

  const canSave = useMemo(() => {
    return (
      name.trim().length > 1 &&
      onlyDigits(whatsapp).length >= 10 &&
      street.trim().length > 1 &&
      number.trim().length > 0 &&
      neighborhood.trim().length > 1 &&
      (stateUf || "").trim().length >= 2 &&
      city.trim().length > 1 &&
      cepValid(cep) &&
      cpfValid(cpf)
    );
  }, [name, whatsapp, street, number, neighborhood, stateUf, city, cep, cpf]);

  // Carrega usuário + perfil
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!data?.user) {
          router.replace("/auth");
          return;
        }
        const uid = data.user.id;
        setUserId(uid);

        const { data: p, error: pErr } = await supabase
          .from("user_profiles")
          .select(
            "id,name,whatsapp,street,number,complement,bairro,city,state,cep,cpf,status"
          )
          .eq("id", uid)
          .maybeSingle();

        if (pErr) throw pErr;

        if (p) {
          setName(p.name ?? "");
          setWhatsapp(p.whatsapp ?? "");
          setStreet(p.street ?? "");
          setNumber(p.number ?? "");
          setComplement(p.complement ?? "");
          setNeighborhood(p.bairro ?? "");
          setCity(p.city ?? "");
          setStateUf((p.state as string) ?? "SP");
          setCep(p.cep ?? "");
          setCpf(p.cpf ?? "");
        }
      } catch (e: any) {
        setErr(e?.message ?? "Não foi possível carregar seu perfil");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  // CEP → auto preencher logradouro/bairro/cidade/UF (sempre sobrescreve ao achar)
  useEffect(() => {
    const s = onlyDigits(cep);
    if (s.length !== 8) return;

    let cancelled = false;
    (async () => {
      const addr = await fetchAddress(s);
      if (!addr || cancelled) return;

      setStreet(addr.street || "");
      setNeighborhood(addr.neighborhood || "");
      setCity(addr.city || "");
      setStateUf(addr.uf || "SP");
    })();

    return () => {
      cancelled = true;
    };
  }, [cep]);

  // Estado → lista de cidades
  useEffect(() => {
    if (!stateUf) return;
    fetchCities(stateUf).then(setCities);
  }, [stateUf]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    try {
      setSaving(true);
      setErr(null);
      setOk(null);

      const payload = {
        id: userId,
        name: name.trim(),
        whatsapp: onlyDigits(whatsapp),
        street: street.trim(),
        number: number.trim(),
        complement: complement.trim(),
        bairro: neighborhood.trim(),
        city: city.trim(),
        state: stateUf.trim(),
        cep: onlyDigits(cep),
        cpf: onlyDigits(cpf),
      };

      const { error: upErr } = await supabase
        .from("user_profiles")
        .upsert(payload, { onConflict: "id" });
      if (upErr) throw upErr;

      // Dispara geocoding assíncrono e silencioso
      try {
        await fetch("/functions/v1/geocode-address", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target: "profiles",
            id: userId,
            address: {
              address_line1: `${payload.street}, ${payload.number}`.trim(),
              address_line2: payload.complement || undefined,
              district: payload.bairro || undefined,
              city: payload.city,
              state: payload.state,
              postal_code: payload.cep,
              country: "BR",
            },
          }),
        });
      } catch {
        // Se a Edge Function ainda não existir, segue sem travar o fluxo
      }

      setOk("Perfil salvo com sucesso.");
      setTimeout(() => router.replace(next), 350);
    } catch (e: any) {
      setErr(e?.message ?? "Não foi possível salvar seu perfil");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-neutral-50" />;
  }

  return (
    <main className="bg-neutral-50 min-h-screen text-neutral-900">
      <div className="max-w-md mx-auto px-5 py-6">
        <h1 className="text-[28px] leading-7 font-bold tracking-tight">
          Meu perfil
        </h1>

        <div className="mt-5">
          <form onSubmit={onSubmit} className="space-y-4">
            {/* Nome */}
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-800">
                Nome
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-3 text-[15px] outline-none focus:ring-2 focus:ring-black/10"
                placeholder="Seu nome"
              />
            </div>

            {/* WhatsApp */}
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-800">
                WhatsApp
              </label>
              <div className="[&_.flag-dropdown]:!h-[48px] [&_.selected-flag]:!h-[48px] [&_.country-list]:!text-sm">
                <PhoneInput
                  country="br"
                  value={whatsapp}
                  onChange={(val) => setWhatsapp(val)}
                  inputProps={{ name: "whatsapp", required: true }}
                  enableSearch
                  inputStyle={{
                    width: "100%",
                    height: "48px",
                    borderRadius: 12,
                    borderColor: "#e5e7eb",
                    background: "#fff",
                    color: "#0a0a0a",
                  }}
                  buttonStyle={{
                    borderTopLeftRadius: 12,
                    borderBottomLeftRadius: 12,
                    borderColor: "#e5e7eb",
                  }}
                />
              </div>
            </div>

            {/* CEP */}
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-800">
                CEP
              </label>
              <input
                value={cep}
                onChange={(e) => setCep(e.target.value)}
                inputMode="numeric"
                placeholder="01311000"
                className={`w-full rounded-xl border px-3 py-3 text-[15px] outline-none focus:ring-2 ${
                  cep.length > 0 && !cepValid(cep)
                    ? "border-red-300 focus:ring-red-200 bg-red-50"
                    : "border-neutral-200 focus:ring-black/10 bg-white"
                }`}
              />
              {cep.length > 0 && !cepValid(cep) && (
                <p className="mt-1 text-xs text-red-600">
                  CEP deve ter 8 dígitos.
                </p>
              )}
            </div>

            {/* Rua / Número */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium text-neutral-800">
                  Street
                </label>
                <input
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-3 text-[15px] outline-none focus:ring-2 focus:ring-black/10"
                  placeholder="Rua Haddock Lobo"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-800">
                  Number
                </label>
                <input
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-3 text-[15px] outline-none focus:ring-2 focus:ring-black/10"
                  placeholder="123"
                />
              </div>
            </div>

            {/* Complemento */}
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-800">
                Complemento
              </label>
              <input
                value={complement}
                onChange={(e) => setComplement(e.target.value)}
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-3 text-[15px] outline-none focus:ring-2 focus:ring-black/10"
                placeholder="Apto 12"
              />
            </div>

            {/* Bairro */}
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-800">
                Neighborhood (Bairro)
              </label>
              <input
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-3 text-[15px] outline-none focus:ring-2 focus:ring-black/10"
                placeholder="Bela Vista"
              />
            </div>

            {/* Estado + Cidade */}
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <label className="mb-1 block text-sm font-medium text-neutral-800">
                  Estado (UF)
                </label>
                <select
                  value={stateUf}
                  onChange={(e) => setStateUf(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 bg-white appearance-none px-3 py-3 text-[15px] outline-none focus:ring-2 focus:ring-black/10 pr-8"
                >
                  <option value="">Selecione</option>
                  {[
                    "AC",
                    "AL",
                    "AP",
                    "AM",
                    "BA",
                    "CE",
                    "DF",
                    "ES",
                    "GO",
                    "MA",
                    "MT",
                    "MS",
                    "MG",
                    "PA",
                    "PB",
                    "PR",
                    "PE",
                    "PI",
                    "RJ",
                    "RN",
                    "RS",
                    "RO",
                    "RR",
                    "SC",
                    "SP",
                    "SE",
                    "TO",
                  ].map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-9 text-neutral-400">
                  ▼
                </span>
              </div>
              <div className="relative">
                <label className="mb-1 block text-sm font-medium text-neutral-800">
                  Cidade
                </label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 bg-white appearance-none px-3 py-3 text-[15px] outline-none focus:ring-2 focus:ring-black/10 pr-8"
                >
                  <option value="">Selecione</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-9 text-neutral-400">
                  ▼
                </span>
              </div>
            </div>

            {/* CPF */}
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-800">
                CPF
              </label>
              <input
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                inputMode="numeric"
                placeholder="000.000.000-00"
                className={`w-full rounded-xl border px-3 py-3 text-[15px] outline-none focus:ring-2 ${
                  cpf.length > 0 && !cpfValid(cpf)
                    ? "border-red-300 focus:ring-red-200 bg-red-50"
                    : "border-neutral-200 focus:ring-black/10 bg-white"
                }`}
              />
              {cpf.length > 0 && !cpfValid(cpf) && (
                <p className="mt-1 text-xs text-red-600">
                  CPF inválido. Verifique os dígitos.
                </p>
              )}
            </div>

            {err && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {err}
              </p>
            )}
            {ok && (
              <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                {ok}
              </p>
            )}

            <button
              type="submit"
              disabled={!canSave || saving}
              className="w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save profile"}
            </button>
          </form>
        </div>

        <div className="mt-4 flex justify-center">
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.replace("/auth");
            }}
            className="text-xs text-neutral-600 underline"
          >
            Sign out
          </button>
        </div>
      </div>
    </main>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-neutral-50" />}>
      <ProfilePageInner />
    </Suspense>
  );
}
