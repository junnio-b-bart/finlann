// Cliente simples para Google Drive usando Google Identity Services (front-end only)
// Requer definir FINLANN_GOOGLE_CLIENT_ID no ambiente de build do Vite.

import { exportState, mergeRemoteAndLocal, normalizeState } from "./finance.sync.js";

const CLIENT_ID = __FINLANN_GOOGLE_CLIENT_ID__;
const API_SCOPE = "https://www.googleapis.com/auth/drive.file"; // acesso só a arquivos criados pelo app
const APP_FOLDER_NAME = "Finlann";
const APP_FILE_NAME = "finlann-state.json";

let accessToken = null;
let currentUser = null; // { name, email, picture }

export function isGoogleConfigured() {
  return Boolean(CLIENT_ID);
}

export function isLoggedInToGoogle() {
  return Boolean(accessToken);
}

export function getCurrentGoogleUser() {
  return currentUser;
}

export async function ensureGoogleScriptLoaded() {
  if (window.google && window.google.accounts && window.gapi) return;

  await new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-finlann-gis]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.finlannGis = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar Google Identity Services"));
    document.head.appendChild(script);
  });

  await new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-finlann-gapi]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }

    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.defer = true;
    script.dataset.finlannGapi = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar Google API JS"));
    document.head.appendChild(script);
  });
}

async function initGapiClient() {
  await new Promise((resolve, reject) => {
    window.gapi.load("client", { callback: resolve, onerror: reject });
  });

  await window.gapi.client.init({
    apiKey: undefined, // não usamos API key, só OAuth com access token
    discoveryDocs: [
      "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
    ],
  });
}

export async function loginWithGoogle() {
  if (!CLIENT_ID) {
    throw new Error("FINLANN_GOOGLE_CLIENT_ID não configurado");
  }

  await ensureGoogleScriptLoaded();

  const tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: API_SCOPE + " https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
    prompt: "consent",
    callback: () => {},
  });

  return new Promise((resolve, reject) => {
    tokenClient.callback = async (resp) => {
      if (resp.error) {
        reject(resp);
        return;
      }
      accessToken = resp.access_token;

      try {
        const profileResp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (profileResp.ok) {
          const data = await profileResp.json();
          currentUser = {
            name: data.name || data.given_name || data.email || "Usuário Google",
            email: data.email || null,
            picture: data.picture || null,
          };
        }
      } catch (e) {
        console.warn("[Finlann] Não foi possível carregar perfil do usuário Google", e);
      }

      resolve(resp);
    };
    tokenClient.requestAccessToken();
  });
}

async function authorizedGapi() {
  if (!accessToken) {
    throw new Error("Sem token de acesso do Google. Faça login primeiro.");
  }
  await ensureGoogleScriptLoaded();
  await initGapiClient();
  window.gapi.client.setToken({ access_token: accessToken });
  return window.gapi.client;
}

async function ensureAppFolder(drive) {
  const res = await drive.drive.files.list({
    q: `mimeType = 'application/vnd.google-apps.folder' and name = '${APP_FOLDER_NAME}' and trashed = false`,
    fields: "files(id, name)",
    spaces: "drive",
  });

  if (res.result.files && res.result.files.length > 0) {
    return res.result.files[0].id;
  }

  const createRes = await drive.drive.files.create({
    resource: {
      name: APP_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id",
  });

  return createRes.result.id;
}

async function getAppFile(drive, folderId) {
  const res = await drive.drive.files.list({
    q: `'${folderId}' in parents and name = '${APP_FILE_NAME}' and trashed = false`,
    fields: "files(id, name)",
    spaces: "drive",
  });

  if (res.result.files && res.result.files.length > 0) {
    return res.result.files[0].id;
  }

  return null;
}

async function downloadJsonFile(drive, fileId) {
  const res = await drive.drive.files.get({
    fileId,
    alt: "media",
  });
  return res.result;
}

// Lê o estado remoto do Drive (se existir) sem modificar nada
export async function loadRemoteStateFromDrive() {
  const drive = await authorizedGapi();
  const folderId = await ensureAppFolder(drive);
  const existingFileId = await getAppFile(drive, folderId);

  if (!existingFileId) return null;

  try {
    const remoteState = await downloadJsonFile(drive, existingFileId);
    return normalizeState(remoteState);
  } catch (err) {
    console.warn("[Finlann] Erro ao ler estado remoto ao fazer login", err);
    return null;
  }
}

async function uploadJsonFile(drive, folderId, fileId, data) {
  const metadata = {
    name: APP_FILE_NAME,
    parents: [folderId],
  };

  const body = JSON.stringify(data);

  if (!fileId) {
    // create
    const res = await drive.drive.files.create({
      resource: metadata,
      media: {
        mimeType: "application/json",
        body,
      },
      fields: "id",
    });
    return res.result.id;
  }

  // update (garante nome + pasta corretos)
  await drive.drive.files.update({
    fileId,
    resource: metadata,
    media: {
      mimeType: "application/json",
      body,
    },
  });

  return fileId;
}

export async function logoutFromGoogle() {
  if (!accessToken) {
    currentUser = null;
    return;
  }

  try {
    await new Promise((resolve) => {
      // revoga token para esta aplicação
      window.google.accounts.oauth2.revoke(accessToken, () => resolve());
    });
  } catch (e) {
    console.warn("[Finlann] Falha ao revogar token Google", e);
  }

  accessToken = null;
  currentUser = null;
}

export async function syncWithGoogleDrive(financeState) {
  const drive = await authorizedGapi();

  const folderId = await ensureAppFolder(drive);
  const existingFileId = await getAppFile(drive, folderId);

  let remoteState = null;
  if (existingFileId) {
    try {
      remoteState = await downloadJsonFile(drive, existingFileId);
    } catch (err) {
      console.warn("[Finlann] Erro lendo arquivo remoto, seguindo com somente local", err);
    }
  }

  const localExport = exportState(financeState);
  const merged = mergeRemoteAndLocal(remoteState, localExport);

  const newFileId = await uploadJsonFile(drive, folderId, existingFileId, merged);

  console.log("[Finlann] syncWithGoogleDrive concluído, fileId=", newFileId);

  return merged;
}
