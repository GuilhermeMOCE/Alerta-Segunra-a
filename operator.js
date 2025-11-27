// ===== VARIÁVEIS DO OPERADOR =====
let operatorMap = null;
const operatorReportMarkers = {};
let operatorReportsListener = null;
let selectedReportId = null;
let allReports = [];

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
                
                console.log('📄 Mudança detectada:', change.type, reportId);
                
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