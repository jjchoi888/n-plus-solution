// apps/guest-app/lib/firebase.js
import { initializeApp } from 'firebase/app';

// 대표님의 Firebase 프로젝트 설정값 (Firebase Console에서 확인 가능)
const firebaseConfig = {
    apiKey: "AIzaSyAaO32y6cwOQiQWWrjCnIe-3qMnybX5Nik",
    authDomain: "hotel-pms-5cf9e.firebaseapp.com",
    projectId: "hotel- pms - 5cf9e",
    storageBucket: "hotel-pms-5cf9e.firebasestorage.app",
    messagingSenderId: "919351571745",
    appId: "1:919351571745:web:a6bf201771e9d68dfffa60"
};

// Firebase 앱 초기화
export const app = initializeApp(firebaseConfig);