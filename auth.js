// ===== FUNÇÕES DE AUTENTICAÇÃO =====

async function registerUser(email, password, name, role) {
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        await user.updateProfile({
            displayName: name
        });

        await db.collection('users').doc(user.uid).set({
            uid: user.uid,
            name: name,
            email: email,
            role: role,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log('✅ Usuário registrado com sucesso:', user.uid);
        return { success: true, user: user, role: role };
    } catch (error) {
        console.error('❌ Erro no registro:', error);
        return { success: false, error: getErrorMessage(error.code) };
    }
}

async function loginUser(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (!userDoc.exists) {
            throw new Error('Dados do usuário não encontrados no banco de dados.');
        }

        const userData = userDoc.data();
        console.log('✅ Login bem-sucedido:', user.uid, '| Role:', userData.role);
        
        return { success: true, user: user, role: userData.role, userData: userData };
    } catch (error) {
        console.error('❌ Erro no login:', error);
        return { success: false, error: getErrorMessage(error.code) };
    }
}

async function logoutUser() {
    try {
        await auth.signOut();
        console.log('✅ Logout realizado');
        window.location.href = 'index.html';
    } catch (error) {
        console.error('❌ Erro no logout:', error);
        alert('Erro ao fazer logout. Tente novamente.');
    }
}

async function getUserData(uid) {
    try {
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
            return userDoc.data();
        }
        return null;
    } catch (error) {
        console.error('❌ Erro ao buscar dados do usuário:', error);
        return null;
    }
}

// ===== FUNÇÕES DE NAVEGAÇÃO =====

function redirectBasedOnRole(role) {
    const currentPage = window.location.pathname.split('/').pop();
    
    if (role === 'operador') {
        if (currentPage !== 'operador.html') {
            window.location.href = 'operador.html';
        }
    } else if (role === 'cidadao') {
        if (currentPage !== 'index.html' && currentPage !== '') {
            window.location.href = 'index.html';
        }
    }
}

async function checkPagePermission() {
    const currentPage = window.location.pathname.split('/').pop();
    
    if (currentPage === 'operador.html') {
        const user = auth.currentUser;
        
        if (!user) {
            showAccessDenied();
            return false;
        }
        
        const userData = await getUserData(user.uid);
        
        if (!userData || userData.role !== 'operador') {
            showAccessDenied();
            return false;
        }
        
        return true;
    }
    
    return true;
}

function showAccessDenied() {
    const loadingScreen = document.getElementById('loading-screen');
    const operatorPanel = document.getElementById('operator-panel');
    const accessDenied = document.getElementById('access-denied');
    
    if (loadingScreen) loadingScreen.classList.add('hidden');
    if (operatorPanel) operatorPanel.classList.add('hidden');
    if (accessDenied) accessDenied.classList.remove('hidden');
}

// ===== OBSERVER DE AUTENTICAÇÃO =====

auth.onAuthStateChanged(async (user) => {
    console.log('🔄 Estado de autenticação alterado');
    
    if (user) {
        console.log('👤 Usuário logado:', user.email);
        currentUser = user;
        
        const userData = await getUserData(user.uid);
        
        if (userData) {
            currentUserRole = userData.role;
            console.log('🎭 Role do usuário:', currentUserRole);
            
            const currentPage = window.location.pathname.split('/').pop();
            
            if (currentPage === 'operador.html') {
                const hasPermission = await checkPagePermission();
                if (hasPermission) {
                    setupOperatorPage(user, userData);
                }
            } else if (currentPage === 'index.html' || currentPage === '') {
                setupIndexPage(user, userData);
            }
        }
    } else {
        console.log('👤 Nenhum usuário logado');
        currentUser = null;
        currentUserRole = null;
        
        const currentPage = window.location.pathname.split('/').pop();
        
        if (currentPage === 'operador.html') {
            window.location.href = 'index.html';
        }
    }
});

// ===== CONFIGURAÇÃO DAS PÁGINAS =====

function setupIndexPage(user, userData) {
    const authArea = document.getElementById('auth-area');
    const citizenArea = document.getElementById('citizen-area');
    
    if (userData.role === 'cidadao') {
        if (authArea) authArea.classList.add('hidden');
        if (citizenArea) citizenArea.classList.remove('hidden');
        
        const userNameDisplay = document.getElementById('user-name-display');
        
        if (userNameDisplay) userNameDisplay.textContent = userData.name;
        
        initCitizenMap();
        
    } else if (userData.role === 'operador') {
        redirectBasedOnRole('operador');
    }
}

function setupOperatorPage(user, userData) {
    const loadingScreen = document.getElementById('loading-screen');
    const operatorPanel = document.getElementById('operator-panel');
    const operatorName = document.getElementById('operator-name');
    
    if (loadingScreen) loadingScreen.classList.add('hidden');
    if (operatorPanel) operatorPanel.classList.remove('hidden');
    if (operatorName) operatorName.textContent = userData.name;
    
    initOperatorMap();
}