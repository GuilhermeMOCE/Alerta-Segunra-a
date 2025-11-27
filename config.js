// ===== CONFIGURAÇÃO DO FIREBASE =====
const firebaseConfig = {
  apiKey: "AIzaSyB0kK1VhvH-cIkwctW0OeOTha6Qxu_BoJw",
  authDomain: "alerta-comunitario-9b024.firebaseapp.com",
  projectId: "alerta-comunitario-9b024",
  storageBucket: "alerta-comunitario-9b024.firebasestorage.app",
  messagingSenderId: "163990112201",
  appId: "1:163990112201:web:7277e5a10fccf8fe67ca18",
  measurementId: "G-1MS4BNV3BY"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ===== VARIÁVEIS GLOBAIS =====
let currentUser = null;
let currentUserRole = null;