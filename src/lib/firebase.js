// Inicialização do Firebase (Auth + Firestore + Storage).
// As credenciais vêm de variáveis de ambiente (arquivo .env na raiz) — copie .env.example.
// Essas chaves identificam o projeto no cliente (não são segredos): a segurança
// real fica nas regras do Firestore/Storage e na configuração da Auth.

import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const required = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID']
for (const k of required) {
  if (!import.meta.env[k]) {
    throw new Error(
      `Variável ${k} ausente. Copie .env.example para .env e preencha com as credenciais do seu projeto Firebase (Console → Configurações do projeto → Seus apps).`,
    )
  }
}

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
