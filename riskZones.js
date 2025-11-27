// ===== VARIÁVEIS DE ZONAS DE RISCO =====
let riskZonesListener = null;
const riskZoneLayers = {};
let drawControl = null;
let drawnItems = null;

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
                
                console.log('📄 Mudança em alerta:', change.type, alertId);
                
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