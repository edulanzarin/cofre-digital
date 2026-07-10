"use client";

import forge from "node-forge";
import { formatDocument, type CertType } from "./certificates";

export type PfxData = {
  holder: string;
  document: string;
  type: CertType;
  issuer: string;
  issuedAt: string; // ISO
  expiresAt: string; // ISO
};

export class PfxError extends Error {}

function bufferToBinaryString(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return out;
}

export function bufferToBase64(buffer: ArrayBuffer): string {
  return btoa(bufferToBinaryString(buffer));
}

export function base64ToBlob(base64: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: "application/x-pkcs12" });
}

// Lê um .pfx/.p12 (PKCS#12) e extrai os dados do certificado do titular.
// Certificados ICP-Brasil trazem o CN no formato "NOME:CPF/CNPJ".
export function parsePfx(buffer: ArrayBuffer, password: string): PfxData {
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    const asn1 = forge.asn1.fromDer(bufferToBinaryString(buffer));
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
  } catch {
    throw new PfxError(
      "Não foi possível ler o arquivo. Confira a senha e se o arquivo é um .pfx/.p12 válido.",
    );
  }

  const bags = p12.getBags({ bagType: forge.pki.oids.certBag })[
    forge.pki.oids.certBag
  ];
  const certs = (bags ?? [])
    .map((bag) => bag.cert)
    .filter((c): c is forge.pki.Certificate => Boolean(c));

  if (certs.length === 0) {
    throw new PfxError("O arquivo não contém nenhum certificado.");
  }

  // O .pfx pode trazer a cadeia inteira (AC raiz, intermediária…).
  // O certificado do titular é o que não assina nenhum outro da lista.
  const dn = (name: { attributes: { shortName?: string; value?: unknown }[] }) =>
    name.attributes.map((a) => `${a.shortName}=${String(a.value)}`).join(",");
  const leaf =
    certs.find((c) =>
      certs.every((other) => other === c || dn(other.issuer) !== dn(c.subject)),
    ) ?? certs[0];

  const cn = String(leaf.subject.getField("CN")?.value ?? "");
  const [rawName, rawDoc] = cn.includes(":") ? cn.split(":") : [cn, ""];
  const docDigits = rawDoc.replace(/\D/g, "");

  const type: CertType =
    docDigits.length === 14
      ? "e-CNPJ A1"
      : docDigits.length === 11
        ? "e-CPF A1"
        : "e-CNPJ A1";

  const issuer = String(
    leaf.issuer.getField("CN")?.value ?? leaf.issuer.getField("O")?.value ?? "",
  );

  return {
    holder: rawName.trim(),
    document: docDigits ? formatDocument(docDigits) : "",
    type,
    issuer: issuer.trim(),
    issuedAt: leaf.validity.notBefore.toISOString(),
    expiresAt: leaf.validity.notAfter.toISOString(),
  };
}
