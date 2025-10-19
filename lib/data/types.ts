// lib/data/types.ts

export type Profile = {
  id: string;
  name: string | null;
  whatsapp: string | null;

  // endereço
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood?: string | null; // se existir
  city: string | null;
  state: string | null; // alguns ambientes podem não ter; tratamos como opcional
  cep: string | null;

  // status/cadastro
  status: string | null;

  // coords (podem ainda não existir no frontend)
  lat?: number | null;
  lng?: number | null;
};

export type Product = {
  id: number;
  name: string;
  price_tag: number;

  // mídia
  photo_url: string[] | string | null;

  // taxonomia
  category?: string | null;
  gender?: "male" | "female" | string | null;
  sizes?: string[] | string | null;
  categories?: string[] | null;

  // loja
  store_name: string;
  store_id: number | null;
  store_slug: string | null;

  // ETA (vêm da view products_with_store_eta)
  eta_text?: string | null;
  eta_text_runtime?: string | null;
  eta_display?: string | null;

  // horários/textos da store (se a view expor)
  open_time?: string | null;
  close_time?: string | null;
  eta_text_default?: string | null;
  eta_text_before_open?: string | null;
  eta_text_after_close?: string | null;

  // métricas opcionais
  view_count?: number | null;

  // relação crua opcional (se a view incluir)
  stores?: any;
};
