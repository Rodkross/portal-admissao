// Camada de dados do portal — Firebase (Auth + Firestore + Storage).
//
// Estrutura no Firestore:
//   candidatos/{id}            — dados do candidato (arquivos ficam em arquivos/{id} do Storage, metadados no doc)
//   notificacoes/{id}          — { para, resumo, tipo, lida, data }
//
// No Storage:
//   documentos/{candidatoId}/{arquivoId}-{nome}   (bucket privado; acesso via getDownloadURL)
//
// Subcoleções mantidas inline no doc do candidato (tamanho pequeno):
//   comunicacoes: [...], ficha: {...}, contrato: {...}

import {
  collection, doc, getDoc, getDocs, onSnapshot, setDoc, addDoc, deleteDoc,
  query, where, orderBy, limit, updateDoc, serverTimestamp,
} from 'firebase/firestore'
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged, signInAnonymously,
} from 'firebase/auth'
import {
  ref, uploadBytes, deleteObject, getDownloadURL,
} from 'firebase/storage'
import { auth, db, storage } from './firebase'


// ---------------- Sessão / usuários internos (Firebase Auth) ----------------
// O perfil ('rh' | 'recrutador') fica no Firestore em usuarios/{uid}.

export async function loginFB(email, senha, perfilEsperado) {
  let cred
  try {
    cred = await signInWithEmailAndPassword(auth, email.trim(), senha)
  } catch {
    return { ok: false, erro: 'E-mail ou senha inválidos.' }
  }
  const snap = await getDoc(doc(db, 'usuarios', cred.user.uid))
  if (!snap.exists()) {
    await signOut(auth)
    return { ok: false, erro: 'Usuário sem perfil configurado. Contate o RH.' }
  }
  const perfil = snap.data().perfil
  if (perfilEsperado && perfil !== perfilEsperado) {
    await signOut(auth)
    return { ok: false, erro: `Esta conta é de ${perfil === 'rh' ? 'RH' : 'Recrutador'}. Selecione o acesso correto.` }
  }
  return {
    ok: true,
    usuario: { id: cred.user.uid, nome: snap.data().nome, email: cred.user.email, perfil },
  }
}

export function observarSessao(cb) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) return cb(null)
    const snap = await getDoc(doc(db, 'usuarios', user.uid))
    cb(snap.exists()
      ? { id: user.uid, nome: snap.data().nome, email: user.email, perfil: snap.data().perfil }
      : null)
  })
}

export const logoutFB = () => signOut(auth)

// Login anônimo para o portal do candidato (necessário para as regras do Firestore).
// Não faz nada se já houver uma sessão (ex.: usuário interno navegando na área do candidato).
export async function entrarAnonimoFB() {
  if (auth.currentUser) return
  try {
    await signInAnonymously(auth)
  } catch (e) {
    console.error('Falha no login anônimo (verifique se o provedor Anônimo está ativo no Firebase Auth):', e)
  }
}

export async function criarUsuarioFB({ nome, email, senha, perfil }, usuarioAtual) {
  if (!usuarioAtual || usuarioAtual.perfil !== 'rh') {
    return { ok: false, erro: 'Somente o RH pode criar usuários.' }
  }
  // Cria via auth secundária para não derrubar a sessão do RH logado.
  const { getAuth, createUserWithEmailAndPassword: create } = await import('firebase/auth')
  const { initializeApp, deleteApp } = await import('firebase/app')
  const app2 = initializeApp(auth.app.options, `admin-${Date.now()}`)
  const auth2 = getAuth(app2)
  try {
    const cred = await create(auth2, email.trim(), senha)
    await setDoc(doc(db, 'usuarios', cred.user.uid), {
      nome: nome.trim(), email: email.trim().toLowerCase(), perfil,
      criadoPor: usuarioAtual.email, criadoEm: serverTimestamp(),
    })
    return { ok: true }
  } catch (e) {
    const msg = e?.code === 'auth/email-already-in-use'
      ? 'Já existe um usuário com este e-mail.'
      : e?.code === 'auth/weak-password'
        ? 'A senha deve ter pelo menos 6 caracteres.'
        : 'Falha ao criar usuário. Verifique os dados.'
    return { ok: false, erro: msg }
  } finally {
    await deleteApp(app2).catch(() => { })
  }
}

export async function removerUsuarioFB(uid, usuarioAtual) {
  if (uid === usuarioAtual?.id) return { ok: false, erro: 'Você não pode remover a si mesmo.' }
  // Nota: para apagar também a conta de login é preciso Admin SDK (backend).
  // Aqui removemos o perfil no Firestore — o usuário perde o acesso ao portal.
  await deleteDoc(doc(db, 'usuarios', uid))
  return { ok: true }
}

// ---------------- Configuração geral (empresas, funções) ----------------
// doc único: config/geral → { empresas: [], funcoes: [] }

export function observarConfig(cb) {
  return onSnapshot(doc(db, 'config', 'geral'), (snap) => {
    cb(snap.exists() ? snap.data() : { empresas: [], funcoes: [] })
  })
}

export async function salvarConfigFB(atualizador) {
  const snap = await getDoc(doc(db, 'config', 'geral'))
  const atual = snap.exists() ? snap.data() : { empresas: [], funcoes: [] }
  await setDoc(doc(db, 'config', 'geral'), atualizador({ ...atual }))
}

// ---------------- Usuários internos (lista para o painel do RH) ----------------

export function observarUsuarios(cb) {
  return onSnapshot(collection(db, 'usuarios'), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

// ---------------- Candidatos (Firestore, tempo real) ----------------

export function observarCandidatos(cb) {
  const escutar = () => onSnapshot(
    collection(db, 'candidatos'),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    // Se a escuta morrer (ex.: permissão negada antes do login anônimo concluir), reconecta.
    (err) => {
      console.error('observarCandidatos:', err)
      setTimeout(escutar, 2000)
    },
  )
  return escutar()
}

export async function criarCandidatoFB(candidato) {
  const dados = { ...candidato }
  delete dados.id
  await setDoc(doc(collection(db, 'candidatos')), { ...dados, criadoEm: serverTimestamp() })
}

export async function atualizarCandidatoFB(id, fn) {
  // `fn` opera sobre o doc atual — lê, aplica e grava (documento pequeno, OK).
  try {
    const snap = await getDoc(doc(db, 'candidatos', id))
    if (!snap.exists()) return
    const atualizado = fn({ id: snap.id, ...snap.data() })
    const dados = { ...atualizado }
    delete dados.id
    await setDoc(doc(db, 'candidatos', id), dados)
  } catch (e) {
    console.error('Falha ao salvar candidato no Firestore (verifique as regras e o login anônimo):', e)
    throw e
  }
}

export async function marcarNotificacoesLidasFB(para) {
  const q = query(collection(db, 'notificacoes'), where('para', '==', para), where('lida', '==', false))
  const snap = await getDocs(q)
  await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { lida: true })))
}

export function observarNotificacoes(para, cb) {
  const q = query(
    collection(db, 'notificacoes'),
    where('para', '==', para),
    orderBy('data', 'desc'),
    limit(50),
  )
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data(), data: d.data().data?.toDate?.().toISOString() || new Date().toISOString() })))
  })
}

export async function notificarFB(para, resumo, tipo = 'info') {
  await addDoc(collection(db, 'notificacoes'), {
    para, resumo, tipo, lida: false, data: new Date().toISOString(),
  })
}

// ---------------- Arquivos (Firebase Storage) ----------------

export async function enviarArquivoFB(candidatoId, arquivoId, file) {
  const caminho = `documentos/${candidatoId}/${arquivoId}-${file.name}`
  await uploadBytes(ref(storage, caminho), file)
  return caminho
}

export async function urlArquivoFB(caminho) {
  if (!caminho) return null
  try {
    return await getDownloadURL(ref(storage, caminho))
  } catch {
    return null
  }
}

export async function excluirArquivoFB(candidatoId, arquivoId, nomeArquivo) {
  try {
    await deleteObject(ref(storage, `documentos/${candidatoId}/${arquivoId}-${nomeArquivo}`))
  } catch { /* arquivo pode não existir */ }
}
