// --- KONFIGURACE MQTT ---
const MQTT_HOST = "6b21f01c6a0e4cc08a8ae8d7acbcecb5.s1.eu.hivemq.cloud";
const MQTT_PORT = 8884;
const MQTT_USER = "web-client";
const MQTT_PASS = "Lolopolo123"; 

const MQTT_TOPIC_GRID = "light/grid"; // Téma pro pixely

// --- PROMĚNNÉ ---
let isDrawing = false;
// Unikátní ID klienta
const clientID = "web_client_" + new Date().getTime();
const client = new Paho.MQTT.Client(MQTT_HOST, MQTT_PORT, clientID);

// --- INIT PO NAČTENÍ STRÁNKY ---
window.onload = function() {
    // 1. Připojení k MQTT
    connectMQTT();

    // 2. Vytvoření mřížky
    createGrid();
    
    // 3. Globální listener pro ukončení kreslení
    window.addEventListener('mouseup', () => { isDrawing = false; });
};

// --- MQTT LOGIKA ---
function connectMQTT() {
    const options = {
        useSSL: true,
        userName: MQTT_USER,
        password: MQTT_PASS,
        onSuccess: onConnect,
        onFailure: onFailure
    };
    client.connect(options);
}

function onConnect() {
    console.log("Připojeno k MQTT Brokeru");
    const statusEl = document.getElementById("status");
    if(statusEl) {
        statusEl.innerText = "Stav: PŘIPOJENO (Online)";
        statusEl.style.color = "green";
    }
}

function onFailure(message) {
    console.log("Chyba: " + message.errorMessage);
    const statusEl = document.getElementById("status");
    if(statusEl) {
        statusEl.innerText = "Stav: CHYBA PŘIPOJENÍ";
        statusEl.style.color = "red";
    }
}

// Funkce pro odeslání binárních dat
function sendMqttBinary(topic, buffer) {
    if (!client.isConnected()) {
        console.log("MQTT není připojeno!");
        return;
    }

    // Paho MQTT pozná, že mu dáváš buffer (ArrayBuffer/TypedArray)
    const message = new Paho.MQTT.Message(buffer);
    message.destinationName = topic;
    client.send(message);
    
    // ZDE BYLA CHYBA: Musíme zavolat logování, aby se to ukázalo na webu
    logToConsole(buffer);
}

// --- LOGOVÁNÍ DO KONZOLE NA WEBU ---
function logToConsole(payload) {
    const consoleBox = document.getElementById('console-log');
    if (!consoleBox) return;

    // Odstraníme placeholder
    const placeholder = consoleBox.querySelector('.log-placeholder');
    if (placeholder) placeholder.remove();

    const now = new Date();
    const timeStr = now.toLocaleTimeString();

    let dataDisplay = "";
    if (payload instanceof Uint8Array || payload instanceof ArrayBuffer) {
        const bytes = new Uint8Array(payload);
        dataDisplay = "[" + Array.from(bytes).join(", ") + "]";
        
        if (bytes.length === 5) {
            dataDisplay += ` (X:${bytes[0]} Y:${bytes[1]} RGB)`;
        } else if (bytes.length === 1 && bytes[0] === 255) {
            dataDisplay += " (CLEAR)";
        }
    } else {
        dataDisplay = payload.toString();
    }

    const entry = document.createElement('div');
    entry.classList.add('log-entry');
    entry.innerHTML = `<span class="log-time">${timeStr}</span> <span class="log-data">${dataDisplay}</span>`;

    consoleBox.prepend(entry);
}

function clearLog() {
    const consoleBox = document.getElementById('console-log');
    consoleBox.innerHTML = '<div class="log-placeholder">Log vymazán...</div>';
}

// --- LOGIKA MŘÍŽKY ---
function createGrid() {
    const grid = document.getElementById('pixel-grid');
    if (!grid) return; 

    grid.innerHTML = ""; 

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const cell = document.createElement('div');
            cell.classList.add('pixel-cell');
            
            // Přepočet souřadnic: 0:0 vlevo dole
            const targetX = col;
            const targetY = 7 - row;

            cell.dataset.x = targetX;
            cell.dataset.y = targetY;

            // Eventy pro myš
            cell.addEventListener('mousedown', (e) => {
                isDrawing = true;
                paintCell(e.target);
            });

            cell.addEventListener('mouseenter', (e) => {
                if (isDrawing) {
                    paintCell(e.target);
                }
            });

            grid.appendChild(cell);
        }
    }
}

function paintCell(cell) {
    const colorPicker = document.getElementById('colorPicker');
    // Ochrana kdyby element neexistoval
    const colorInput = colorPicker ? colorPicker.value : "#ff0000";
    const rgb = hexToRgb(colorInput);
    
    // Vizuální barva hned
    cell.style.backgroundColor = colorInput;

    const x = parseInt(cell.dataset.x);
    const y = parseInt(cell.dataset.y);

    const payload = new Uint8Array([x, y, rgb.r, rgb.g, rgb.b]);

    sendMqttBinary(MQTT_TOPIC_GRID, payload);
}

function clearGrid() {
    const payload = new Uint8Array([255]);
    
    // Vizuální reset buněk na šedou
    const cells = document.querySelectorAll('.pixel-cell');
    cells.forEach(cell => {
        cell.style.backgroundColor = '#eee';
    });
    
    sendMqttBinary(MQTT_TOPIC_GRID, payload);
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}