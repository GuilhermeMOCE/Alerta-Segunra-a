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

// ===== VARIÁVEIS DO MAPA (CIDADÃO) =====
let map = null;
let userMarker = null;
let currentUserLocation = null;
let reportsListener = null;
const reportMarkers = {};

// ===== VARIÁVEIS DO OPERADOR =====
let operatorMap = null;
const operatorReportMarkers = {};
let operatorReportsListener = null;
let selectedReportId = null;
let allReports = [];

// ===== VARIÁVEIS DE ZONAS DE RISCO =====
let riskZonesListener = null;
const riskZoneLayers = {};
let drawControl = null;
let drawnItems = null;

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

// ===== FUNÇÕES DO MAPA (CIDADÃO) =====

function initCitizenMap() {
    console.log('🗺️ Inicializando mapa do cidadão...');
    
    map = L.map('map').setView([-8.0476, -34.8770], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    getUserLocation();
    loadReports();
    loadRiskZones(map, false);
}

function getUserLocation() {
    if (!navigator.geolocation) {
        console.warn('⚠️ Geolocalização não suportada');
        alert('Seu navegador não suporta geolocalização.');
        return;
    }
    
    console.log('📍 Solicitando localização...');
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            console.log('✅ Localização obtida:', lat, lng);
            
            currentUserLocation = { lat, lng };
            map.setView([lat, lng], 15);
            
            if (userMarker) {
                map.removeLayer(userMarker);
            }
            
            const blueIcon = L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            });
            
            userMarker = L.marker([lat, lng], { icon: blueIcon })
                .addTo(map)
                .bindPopup('<b>📍 Você está aqui</b>')
                .openPopup();
        },
        (error) => {
            console.error('❌ Erro ao obter localização:', error);
            
            let errorMsg = 'Não foi possível obter sua localização.';
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMsg = 'Você negou a permissão de localização. Para usar o recurso de relatos, permita o acesso à localização.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMsg = 'Localização indisponível no momento.';
                    break;
                case error.TIMEOUT:
                    errorMsg = 'Tempo esgotado ao tentar obter localização.';
                    break;
            }
            
            alert(errorMsg);
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

function loadReports() {
    console.log('🔥 Carregando relatos...');
    
    reportsListener = db.collection('reports')
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                const reportData = change.doc.data();
                const reportId = change.doc.id;
                
                if (change.type === 'added') {
                    addReportMarker(reportId, reportData);
                } else if (change.type === 'modified') {
                    updateReportMarker(reportId, reportData);
                } else if (change.type === 'removed') {
                    removeReportMarker(reportId);
                }
            });
        }, (error) => {
            console.error('❌ Erro ao carregar relatos:', error);
        });
}

function addReportMarker(reportId, reportData) {
    if (!reportData.location || !map) return;
    
    const { lat, lng } = reportData.location;
    
    const status = reportData.status || 'aberto';
    const statusColors = {
        'aberto': 'red',
        'confirmado': 'red',
        'atendimento': 'orange',
        'resolvido': 'green'
    };
    
    const markerColor = statusColors[status] || 'red';
    
    const typeIcons = {
        'alagamento': '🌊',
        'deslizamento': '⛰️',
        'incendio': '🔥',
        'acidente': '🚗',
        'outro': '❓'
    };
    
    const markerIcon = L.icon({
        iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${markerColor}.png`,
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });
    
    const marker = L.marker([lat, lng], { icon: markerIcon }).addTo(map);
    
    const typeIcon = typeIcons[reportData.type] || '❓';
    const typeName = reportData.type.charAt(0).toUpperCase() + reportData.type.slice(1);
    const date = reportData.createdAt ? new Date(reportData.createdAt.toDate()).toLocaleString('pt-BR') : 'Agora';
    
    const statusLabels = {
        'aberto': '🟡 Aberto',
        'confirmado': '🔴 Confirmado',
        'atendimento': '🟠 Em Atendimento',
        'resolvido': '🟢 Resolvido'
    };
    
    const statusLabel = statusLabels[status] || '🟡 Aberto';
    
    const popupContent = `
        <div style="min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; color: #1e293b;">${typeIcon} ${typeName}</h3>
            <div style="margin: 0 0 8px 0;">
                <span style="background: rgba(0,0,0,0.1); padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">${statusLabel}</span>
            </div>
            <p style="margin: 0 0 4px 0; color: #64748b; font-size: 0.85rem;">${reportData.description}</p>
            <p style="margin: 0; color: #94a3b8; font-size: 0.75rem;">📅 ${date}</p>
        </div>
    `;
    
    marker.bindPopup(popupContent);
    reportMarkers[reportId] = marker;
    
    console.log('✅ Marcador adicionado:', reportId);
}

function updateReportMarker(reportId, reportData) {
    if (reportMarkers[reportId]) {
        removeReportMarker(reportId);
        addReportMarker(reportId, reportData);
    }
}

function removeReportMarker(reportId) {
    if (reportMarkers[reportId]) {
        map.removeLayer(reportMarkers[reportId]);
        delete reportMarkers[reportId];
        console.log('🗑️ Marcador removido:', reportId);
    }
}

// ===== FUNÇÕES DO MODAL =====

function openReportModal() {
    console.log('📝 Abrindo modal de relato...');
    
    if (!currentUserLocation) {
        getUserLocationForReport();
    } else {
        const modal = document.getElementById('report-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }
}

function closeReportModal() {
    const modal = document.getElementById('report-modal');
    const form = document.getElementById('report-form');
    
    if (modal) {
        modal.classList.add('hidden');
    }
    
    if (form) {
        form.reset();
    }
}

function getUserLocationForReport() {
    if (!navigator.geolocation) {
        alert('Geolocalização não disponível.');
        return;
    }
    
    console.log('📍 Obtendo localização para relato...');
    
    const locationText = document.getElementById('location-text');
    if (locationText) {
        locationText.textContent = 'Obtendo localização...';
    }
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            currentUserLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            
            console.log('✅ Localização atualizada:', currentUserLocation);
            
            if (locationText) {
                locationText.textContent = 'Usando sua localização atual';
            }
            
            const modal = document.getElementById('report-modal');
            if (modal) {
                modal.classList.remove('hidden');
            }
        },
        (error) => {
            console.error('❌ Erro ao obter localização:', error);
            alert('Não foi possível obter sua localização. Verifique as permissões.');
            
            if (locationText) {
                locationText.textContent = 'Localização não disponível';
            }
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

async function submitReport(type, description) {
    if (!currentUserLocation) {
        alert('Localização não disponível. Tente novamente.');
        return;
    }
    
    if (!currentUser) {
        alert('Você precisa estar logado para enviar um relato.');
        return;
    }
    
    try {
        console.log('📤 Enviando relato...');
        
        const reportData = {
            type: type,
            description: description,
            location: {
                lat: currentUserLocation.lat,
                lng: currentUserLocation.lng
            },
            userId: currentUser.uid,
            userName: currentUser.displayName || 'Cidadão',
            status: 'aberto',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('reports').add(reportData);
        
        console.log('✅ Relato enviado com sucesso!');
        alert('Relato enviado com sucesso! ✅');
        
        closeReportModal();
        
    } catch (error) {
        console.error('❌ Erro ao enviar relato:', error);
        alert('Erro ao enviar relato. Tente novamente.');
    }
}

// ===== FUNÇÕES DO OPERADOR =====

function initOperatorMap() {
    console.log('🗺️ Inicializando mapa do operador...');
    
    const mapElement = document.getElementById('operator-map');
    if (!mapElement) {
        console.error('❌ Elemento #operator-map não encontrado!');
        return;
    }
    
    console.log('✅ Elemento do mapa encontrado, criando instância...');
    
    operatorMap = L.map('operator-map').setView([-8.0476, -34.8770], 13);
    
    console.log('✅ Mapa criado, adicionando tiles...');
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(operatorMap);
    
    console.log('✅ Tiles adicionados, aguardando carregamento...');
    
    operatorMap.whenReady(() => {
        console.log('✅ Mapa do operador pronto!');
        loadOperatorReports();
        loadRiskZones(operatorMap, true);
        initDrawControls();
    });
    
    setTimeout(() => {
        operatorMap.invalidateSize();
        console.log('🔄 Mapa redimensionado');
    }, 250);
}

function loadOperatorReports() {
    console.log('🔥 Carregando relatos do operador...');
    
    operatorReportsListener = db.collection('reports')
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
            console.log('📊 Snapshot recebido. Total de documentos:', snapshot.size);
            
            allReports = [];
            
            snapshot.forEach((doc) => {
                const reportData = doc.data();
                allReports.push({
                    id: doc.id,
                    ...reportData
                });
                console.log('📄 Relato carregado:', doc.id, reportData);
            });
            
            console.log('📦 Total de relatos no array:', allReports.length);
            
            updateOperatorUI();
            
            snapshot.docChanges().forEach((change) => {
                const reportData = change.doc.data();
                const reportId = change.doc.id;
                
                console.log('🔄 Mudança detectada:', change.type, reportId);
                
                if (change.type === 'added') {
                    addOperatorReportMarker(reportId, reportData);
                } else if (change.type === 'modified') {
                    updateOperatorReportMarker(reportId, reportData);
                } else if (change.type === 'removed') {
                    removeOperatorReportMarker(reportId);
                }
            });
            
            console.log('🎯 Total de marcadores no mapa:', Object.keys(operatorReportMarkers).length);
        }, (error) => {
            console.error('❌ Erro ao carregar relatos do operador:', error);
        });
}

function addOperatorReportMarker(reportId, reportData) {
    if (!reportData.location || !operatorMap) {
        console.warn('⚠️ Não foi possível adicionar marcador:', reportId, {
            hasLocation: !!reportData.location,
            hasMap: !!operatorMap
        });
        return;
    }
    
    const { lat, lng } = reportData.location;
    
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        console.warn('⚠️ Coordenadas inválidas para:', reportId, { lat, lng });
        return;
    }
    
    const status = reportData.status || 'aberto';
    
    const statusColors = {
        'aberto': '#FBC02D',
        'confirmado': '#D32F2F',
        'atendimento': '#F57C00',
        'resolvido': '#388E3C'
    };
    
    const color = statusColors[status];
    
    console.log('📍 Adicionando marcador do operador:', reportId, 'em', lat, lng, 'cor:', color);
    
    const marker = L.circleMarker([lat, lng], {
        radius: 12,
        fillColor: color,
        color: '#fff',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.9
    }).addTo(operatorMap);
    
    marker.bindPopup(() => createOperatorPopup(reportId, reportData));
    
    marker.on('click', () => {
        selectReport(reportId);
    });
    
    operatorReportMarkers[reportId] = marker;
    
    console.log('✅ Marcador do operador adicionado com sucesso:', reportId, 'Total:', Object.keys(operatorReportMarkers).length);
}

function updateOperatorReportMarker(reportId, reportData) {
    if (operatorReportMarkers[reportId]) {
        removeOperatorReportMarker(reportId);
        addOperatorReportMarker(reportId, reportData);
    }
}

function removeOperatorReportMarker(reportId) {
    if (operatorReportMarkers[reportId]) {
        operatorMap.removeLayer(operatorReportMarkers[reportId]);
        delete operatorReportMarkers[reportId];
        console.log('🗑️ Marcador do operador removido:', reportId);
    }
}

function createOperatorPopup(reportId, reportData) {
    const status = reportData.status || 'aberto';
    const typeIcons = {
        'alagamento': '🌊',
        'deslizamento': '⛰️',
        'incendio': '🔥',
        'acidente': '🚗',
        'outro': '❓'
    };
    
    const statusLabels = {
        'aberto': 'Aberto',
        'confirmado': 'Confirmado',
        'atendimento': 'Em Atendimento',
        'resolvido': 'Resolvido'
    };
    
    const typeIcon = typeIcons[reportData.type] || '❓';
    const typeName = reportData.type.charAt(0).toUpperCase() + reportData.type.slice(1);
    const date = reportData.createdAt ? new Date(reportData.createdAt.toDate()).toLocaleString('pt-BR') : 'Agora';
    
    const popupDiv = document.createElement('div');
    popupDiv.className = 'operator-popup';
    popupDiv.innerHTML = `
        <div class="operator-popup-header">
            <div class="operator-popup-title">${typeIcon} ${typeName}</div>
            <span class="operator-popup-status popup-status-${status}">${statusLabels[status]}</span>
        </div>
        <p class="operator-popup-description">${reportData.description}</p>
        <div class="operator-popup-meta">
            <div>👤 ${reportData.userName}</div>
            <div>📅 ${date}</div>
        </div>
        <div class="operator-popup-actions">
            <button class="popup-action-btn btn-confirmar" data-action="confirmado" data-id="${reportId}" ${status === 'confirmado' || status === 'atendimento' || status === 'resolvido' ? 'disabled' : ''}>
                Confirmar
            </button>
            <button class="popup-action-btn btn-atender" data-action="atendimento" data-id="${reportId}" ${status === 'atendimento' || status === 'resolvido' ? 'disabled' : ''}>
                Atender
            </button>
            <button class="popup-action-btn btn-finalizar" data-action="resolvido" data-id="${reportId}" ${status === 'resolvido' ? 'disabled' : ''}>
                Finalizar
            </button>
        </div>
    `;
    
    popupDiv.querySelectorAll('.popup-action-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            const id = btn.dataset.id;
            
            if (!btn.disabled) {
                await updateReportStatus(id, action);
            }
        });
    });
    
    return popupDiv;
}

async function updateReportStatus(reportId, newStatus) {
    try {
        console.log(`🔄 Atualizando status do relato ${reportId} para ${newStatus}...`);
        
        await db.collection('reports').doc(reportId).update({
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: currentUser.uid
        });
        
        console.log('✅ Status atualizado com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao atualizar status:', error);
        alert('Erro ao atualizar status. Tente novamente.');
    }
}

function updateOperatorUI() {
    const reportsList = document.getElementById('operator-reports-list');
    const totalReports = document.getElementById('total-reports');
    const statusFilter = document.getElementById('status-filter');
    
    if (!reportsList) return;
    
    const filterValue = statusFilter ? statusFilter.value : 'all';
    const filteredReports = filterValue === 'all' 
        ? allReports 
        : allReports.filter(r => (r.status || 'aberto') === filterValue);
    
    if (totalReports) {
        totalReports.textContent = `${allReports.length} total`;
    }
    
    reportsList.innerHTML = '';
    
    if (filteredReports.length === 0) {
        reportsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔭</div>
                <p>Nenhum relato encontrado</p>
            </div>
        `;
        return;
    }
    
    filteredReports.forEach(report => {
        const card = createReportCard(report);
        reportsList.appendChild(card);
    });
}

function createReportCard(report) {
    const status = report.status || 'aberto';
    const typeIcons = {
        'alagamento': '🌊',
        'deslizamento': '⛰️',
        'incendio': '🔥',
        'acidente': '🚗',
        'outro': '❓'
    };
    
    const typeIcon = typeIcons[report.type] || '❓';
    const typeName = report.type.charAt(0).toUpperCase() + report.type.slice(1);
    const date = report.createdAt ? new Date(report.createdAt.toDate()).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }) : 'Agora';
    
    const card = document.createElement('div');
    card.className = 'report-card';
    if (selectedReportId === report.id) {
        card.classList.add('selected');
    }
    
    card.innerHTML = `
        <div class="report-card-header">
            <span class="report-type">${typeIcon} ${typeName}</span>
            <span class="report-status status-${status}"></span>
        </div>
        <p class="report-description">${report.description}</p>
        <div class="report-meta">
            <span>👤 ${report.userName}</span>
            <span>📅 ${date}</span>
        </div>
    `;
    
    card.addEventListener('click', () => {
        selectReport(report.id);
    });
    
    return card;
}

function selectReport(reportId) {
    selectedReportId = reportId;
    
    document.querySelectorAll('.report-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    const cards = document.querySelectorAll('.report-card');
    const selectedIndex = allReports.findIndex(r => r.id === reportId);
    if (selectedIndex >= 0 && cards[selectedIndex]) {
        cards[selectedIndex].classList.add('selected');
    }
    
    const report = allReports.find(r => r.id === reportId);
    if (report && report.location && operatorMap) {
        operatorMap.setView([report.location.lat, report.location.lng], 16);
        
        if (operatorReportMarkers[reportId]) {
            operatorReportMarkers[reportId].openPopup();
        }
    }
}

// ===== FUNÇÕES DE ZONAS DE RISCO =====

function initDrawControls() {
    if (!operatorMap) {
        console.error('❌ Mapa do operador não inicializado');
        return;
    }
    
    console.log('🎨 Inicializando controles de desenho...');
    
    drawnItems = new L.FeatureGroup();
    operatorMap.addLayer(drawnItems);
    
    drawControl = new L.Control.Draw({
        position: 'topright',
        draw: {
            polyline: false,
            circle: false,
            circlemarker: false,
            marker: false,
            polygon: {
                allowIntersection: false,
                showArea: true,
                shapeOptions: {
                    color: '#D32F2F',
                    fillColor: '#D32F2F',
                    fillOpacity: 0.3,
                    weight: 3
                }
            },
            rectangle: {
                shapeOptions: {
                    color: '#D32F2F',
                    fillColor: '#D32F2F',
                    fillOpacity: 0.3,
                    weight: 3
                }
            }
        },
        edit: {
            featureGroup: drawnItems,
            remove: true
        }
    });
    
    operatorMap.addControl(drawControl);
    
    console.log('✅ Controles de desenho adicionados');
    
    operatorMap.on('draw:created', onDrawCreated);
    operatorMap.on('draw:deleted', onDrawDeleted);
}

async function onDrawCreated(e) {
    const layer = e.layer;
    const type = e.layerType;
    
    console.log('🎨 Polígono criado:', type);
    
    const geoJSON = layer.toGeoJSON();
    
    console.log('📍 GeoJSON:', geoJSON);
    
    try {
        const alertData = {
            type: type,
            geometry: JSON.stringify(geoJSON.geometry),
            severity: 'high',
            active: true,
            createdBy: currentUser.uid,
            createdByName: currentUser.displayName || 'Operador',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            description: 'Área de Risco - Alerta Oficial'
        };
        
        console.log('💾 Salvando zona de risco no Firestore...');
        
        const docRef = await db.collection('alerts').add(alertData);
        
        console.log('✅ Zona de risco salva com ID:', docRef.id);
        
        alert('⚠️ Zona de Risco criada com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao salvar zona de risco:', error);
        alert('Erro ao criar zona de risco. Tente novamente.');
    }
}

function onDrawDeleted(e) {
    const layers = e.layers;
    
    layers.eachLayer((layer) => {
        const alertId = Object.keys(riskZoneLayers).find(
            id => riskZoneLayers[id] === layer
        );
        
        if (alertId) {
            deleteRiskZone(alertId);
        }
    });
}

function loadRiskZones(targetMap, editable = false) {
    if (!targetMap) {
        console.error('❌ Mapa não fornecido para loadRiskZones');
        return;
    }
    
    console.log('🔥 Carregando zonas de risco...', { editable });
    
    riskZonesListener = db.collection('alerts')
        .where('active', '==', true)
        .onSnapshot((snapshot) => {
            console.log('📊 Zonas de risco recebidas:', snapshot.size);
            
            const totalAlerts = document.getElementById('total-alerts');
            if (totalAlerts) {
                totalAlerts.textContent = `${snapshot.size} ativas`;
            }
            
            snapshot.docChanges().forEach((change) => {
                const alertData = change.doc.data();
                const alertId = change.doc.id;
                
                console.log('🔄 Mudança em alerta:', change.type, alertId);
                
                if (change.type === 'added') {
                    addRiskZoneLayer(alertId, alertData, targetMap, editable);
                } else if (change.type === 'modified') {
                    updateRiskZoneLayer(alertId, alertData, targetMap, editable);
                } else if (change.type === 'removed') {
                    removeRiskZoneLayer(alertId, targetMap);
                }
            });
        }, (error) => {
            console.error('❌ Erro ao carregar zonas de risco:', error);
        });
}

function addRiskZoneLayer(alertId, alertData, targetMap, editable) {
    if (!alertData.geometry) {
        console.warn('⚠️ Alerta sem geometria:', alertId);
        return;
    }
    
    console.log('📍 Adicionando zona de risco:', alertId);
    
    let geometry = alertData.geometry;
    if (typeof geometry === 'string') {
        try {
            geometry = JSON.parse(geometry);
        } catch (error) {
            console.error('❌ Erro ao parsear geometria:', error);
            return;
        }
    }
    
    const layer = L.geoJSON(geometry, {
        style: {
            color: '#D32F2F',
            fillColor: '#D32F2F',
            fillOpacity: 0.3,
            weight: 3
        }
    });
    
    const popupContent = createRiskZonePopup(alertId, alertData, editable);
    
    // Vincular popup a cada sublayer individualmente
    layer.eachLayer(l => {
        l.bindPopup(popupContent);
        if (editable && drawnItems) {
            drawnItems.addLayer(l);
        } else {
            l.addTo(targetMap);
        }
    });
    
    riskZoneLayers[alertId] = layer;
    
    console.log('✅ Zona de risco adicionada:', alertId);
}

function createRiskZonePopup(alertId, alertData, editable) {
    const date = alertData.createdAt 
        ? new Date(alertData.createdAt.toDate()).toLocaleString('pt-BR') 
        : 'Agora';
    
    if (editable) {
        const div = document.createElement('div');
        div.className = 'risk-zone-popup';
        div.innerHTML = `
            <div style="min-width: 220px;">
                <h3 style="margin: 0 0 8px 0; color: #D32F2F; display: flex; align-items: center; gap: 8px;">
                    <span>⚠️</span>
                    <span>ÁREA DE RISCO</span>
                </h3>
                <p style="margin: 0 0 8px 0; font-size: 0.85rem; color: #64748b;">
                    ${alertData.description || 'Alerta Oficial'}
                </p>
                <div style="margin: 0 0 12px 0; font-size: 0.75rem; color: #94a3b8;">
                    <div>👤 ${alertData.createdByName || 'Sistema'}</div>
                    <div>📅 ${date}</div>
                </div>
                <button class="btn-remove-alert" data-id="${alertId}" style="
                    width: 100%;
                    padding: 8px;
                    background: #D32F2F;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 0.85rem;
                    transition: all 0.2s;
                ">
                    🗑️ Remover Alerta
                </button>
            </div>
        `;
        
        // Adicionar event listener ao botão com timeout para garantir que o DOM está pronto
        setTimeout(() => {
            const btnRemove = div.querySelector('.btn-remove-alert');
            if (btnRemove) {
                btnRemove.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const id = btnRemove.dataset.id;
                    
                    console.log('🗑️ Tentando remover zona:', id);
                    
                    if (confirm('Tem certeza que deseja remover este alerta?')) {
                        await deleteRiskZone(id);
                    }
                });
                
                // Adicionar hover effect
                btnRemove.addEventListener('mouseenter', () => {
                    btnRemove.style.background = '#B71C1C';
                });
                btnRemove.addEventListener('mouseleave', () => {
                    btnRemove.style.background = '#D32F2F';
                });
            }
        }, 100);
        
        return div;
    } else {
        return `
            <div style="min-width: 200px;">
                <h3 style="margin: 0 0 8px 0; color: #D32F2F; display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.5rem;">⚠️</span>
                    <span>ÁREA DE RISCO</span>
                </h3>
                <p style="margin: 0 0 8px 0; font-size: 0.9rem; font-weight: 600; color: #1e293b;">
                    ${alertData.description || 'Alerta Oficial'}
                </p>
                <p style="margin: 0 0 4px 0; font-size: 0.85rem; color: #64748b;">
                    Evite circular por esta área. Alerta emitido pelas autoridades.
                </p>
                <p style="margin: 0; font-size: 0.75rem; color: #94a3b8;">
                    📅 ${date}
                </p>
            </div>
        `;
    }
}

function updateRiskZoneLayer(alertId, alertData, targetMap, editable) {
    removeRiskZoneLayer(alertId, targetMap);
    addRiskZoneLayer(alertId, alertData, targetMap, editable);
}

function removeRiskZoneLayer(alertId, targetMap) {
    if (riskZoneLayers[alertId]) {
        const layer = riskZoneLayers[alertId];
        
        if (drawnItems && drawnItems.hasLayer) {
            layer.eachLayer(l => {
                if (drawnItems.hasLayer(l)) {
                    drawnItems.removeLayer(l);
                }
            });
        }
        
        if (targetMap) {
            layer.remove();
        }
        
        delete riskZoneLayers[alertId];
        console.log('🗑️ Zona de risco removida:', alertId);
    }
}

async function deleteRiskZone(alertId) {
    try {
        console.log('🗑️ Removendo zona de risco:', alertId);
        
        await db.collection('alerts').doc(alertId).delete();
        
        console.log('✅ Zona de risco removida com sucesso');
        alert('✅ Zona de Risco removida!');
        
    } catch (error) {
        console.error('❌ Erro ao remover zona de risco:', error);
        alert('Erro ao remover zona de risco. Tente novamente.');
    }
}

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

// ===== CONFIGURAÇÃO DA PÁGINA INDEX =====

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

// ===== CONFIGURAÇÃO DA PÁGINA DO OPERADOR =====

function setupOperatorPage(user, userData) {
    const loadingScreen = document.getElementById('loading-screen');
    const operatorPanel = document.getElementById('operator-panel');
    const operatorName = document.getElementById('operator-name');
    
    if (loadingScreen) loadingScreen.classList.add('hidden');
    if (operatorPanel) operatorPanel.classList.remove('hidden');
    if (operatorName) operatorName.textContent = userData.name;
    
    initOperatorMap();
}

// ===== EVENT LISTENERS =====

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Sistema Alerta Comunitário iniciado');
    
    const currentPage = window.location.pathname.split('/').pop();
    
    // ===== PÁGINA INDEX =====
    if (currentPage === 'index.html' || currentPage === '') {
        
        const tabButtons = document.querySelectorAll('.tab-btn');
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                
                tabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                if (tab === 'login') {
                    loginForm.classList.remove('hidden');
                    registerForm.classList.add('hidden');
                } else {
                    loginForm.classList.add('hidden');
                    registerForm.classList.remove('hidden');
                }
                
                hideError('login-error');
                hideError('register-error');
            });
        });
        
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideError('login-error');
            
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            
            const result = await loginUser(email, password);
            
            if (result.success) {
                redirectBasedOnRole(result.role);
            } else {
                showError('login-error', result.error);
            }
        });
        
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideError('register-error');
            
            const name = document.getElementById('register-name').value;
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const role = document.getElementById('register-role').value;
            
            if (!role) {
                showError('register-error', 'Selecione o tipo de conta.');
                return;
            }
            
            const result = await registerUser(email, password, name, role);
            
            if (result.success) {
                redirectBasedOnRole(result.role);
            } else {
                showError('register-error', result.error);
            }
        });
        
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', logoutUser);
        }
        
        const fabBtn = document.getElementById('fab-btn');
        if (fabBtn) {
            fabBtn.addEventListener('click', openReportModal);
        }
        
        const modalClose = document.getElementById('modal-close');
        if (modalClose) {
            modalClose.addEventListener('click', closeReportModal);
        }
        
        const modalCancel = document.getElementById('modal-cancel');
        if (modalCancel) {
            modalCancel.addEventListener('click', closeReportModal);
        }
        
        const modalOverlay = document.querySelector('.modal-overlay');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', closeReportModal);
        }
        
        const reportForm = document.getElementById('report-form');
        if (reportForm) {
            reportForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const type = document.getElementById('report-type').value;
                const description = document.getElementById('report-description').value;
                
                if (!type || !description) {
                    alert('Preencha todos os campos.');
                    return;
                }
                
                await submitReport(type, description);
            });
        }
    }
    
    // ===== PÁGINA DO OPERADOR =====
    if (currentPage === 'operador.html') {
        
        const operatorLogoutBtn = document.getElementById('operator-logout-btn');
        if (operatorLogoutBtn) {
            operatorLogoutBtn.addEventListener('click', logoutUser);
        }
        
        const backToHomeBtn = document.getElementById('back-to-home');
        if (backToHomeBtn) {
            backToHomeBtn.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }
        
        const statusFilter = document.getElementById('status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', () => {
                updateOperatorUI();
            });
        }
    }
});

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