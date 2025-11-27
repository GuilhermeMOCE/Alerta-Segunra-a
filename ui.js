// ===== FUNÇÕES DE UI =====

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
    }
}

function hideError(elementId) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.classList.add('hidden');
    }
}

function getErrorMessage(errorCode) {
    const errorMessages = {
        'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
        'auth/invalid-email': 'E-mail inválido.',
        'auth/operation-not-allowed': 'Operação não permitida.',
        'auth/weak-password': 'Senha muito fraca. Use no mínimo 6 caracteres.',
        'auth/user-disabled': 'Esta conta foi desabilitada.',
        'auth/user-not-found': 'Usuário não encontrado.',
        'auth/wrong-password': 'Senha incorreta.',
        'auth/invalid-credential': 'Credenciais inválidas. Verifique e-mail e senha.',
        'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.'
    };
    
    return errorMessages[errorCode] || 'Erro desconhecido. Tente novamente.';
}

// ===== FUNÇÕES AUXILIARES PARA DEBUG =====

window.testFirebaseConnection = () => {
    console.log('🔥 Testando conexão com Firebase...');
    console.log('Auth:', auth);
    console.log('Firestore:', db);
    console.log('Usuário atual:', auth.currentUser);
};

window.debugOperatorMap = () => {
    console.log('🗺️ DEBUG - Mapa do Operador:');
    console.log('- Mapa inicializado:', !!operatorMap);
    console.log('- Total de relatos:', allReports.length);
    console.log('- Marcadores no mapa:', Object.keys(operatorReportMarkers).length);
    console.log('- Relatos:', allReports);
    console.log('- Marcadores:', operatorReportMarkers);
    
    if (operatorMap) {
        console.log('- Centro do mapa:', operatorMap.getCenter());
        console.log('- Zoom:', operatorMap.getZoom());
    }
    
    if (operatorMap && allReports.length > 0) {
        const testReport = allReports[0];
        console.log('🧪 Tentando adicionar marcador de teste:', testReport);
        if (testReport.location) {
            console.log('📍 Coordenadas:', testReport.location);
        }
    }
};

window.debugRiskZones = () => {
    console.log('⚠️ DEBUG - Zonas de Risco:');
    console.log('- Total de zonas:', Object.keys(riskZoneLayers).length);
    console.log('- Zonas:', riskZoneLayers);
    console.log('- Controle de desenho:', !!drawControl);
    console.log('- Grupo de itens desenhados:', !!drawnItems);
};