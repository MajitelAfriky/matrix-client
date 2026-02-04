// --- KONFIGURACE MQTT ---
// Ujisti se, že máš správnou adresu clusteru z HiveMQ
const MQTT_HOST = "6b21f01c6a0e4cc08a8ae8d7acbcecb5.s1.eu.hivemq.cloud";
const MQTT_PORT = 8884;
const MQTT_USER = "web-client";
const MQTT_PASS = "Lolopolo123"; 

const MQTT_TOPIC_GRID = "light/grid"; 

// --- PROMĚNNÉ ---
let isDrawing = false;
const clientID = "web_client_" + new Date().getTime();
const client = new Paho.MQTT.Client(MQTT_HOST, MQTT_PORT, clientID);

// --- START ---
window.onload = function() {
    connectMQTT();
    createGrid();
    // Pojistka pro puštění myši mimo okno
    window.addEventListener('mouseup', () => { isDrawing = false; });
};

// --- MQTT PŘIPOJENÍ ---
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
    console.log("Připojeno k MQTT");
    updateStatus("Stav: PŘIPOJENO (Online)", "green");
}

function onFailure(message) {
    console.log("Chyba: " + message.errorMessage);
    updateStatus("Stav: CHYBA PŘIPOJENÍ", "red");
}

function updateStatus(text, color) {
    const statusEl = document.getElementById("status");
    if(statusEl) {
        statusEl.innerText = text;
        statusEl.style.color = color;
    }
}

// --- ODESÍLÁNÍ DAT ---
function sendMqttBinary(topic, buffer) {
    if (!client.isConnected()) return;

    const message = new Paho.MQTT.Message(buffer);
    message.destinationName = topic;
    client.send(message);
    
    // Zobrazíme v logu
    logToConsole(buffer);
}

// --- LOGOVÁNÍ (Pro kontrolu indexů) ---
function logToConsole(payload) {
    const consoleBox = document.getElementById('console-log');
    if (!consoleBox) return;

    const placeholder = consoleBox.querySelector('.log-placeholder');
    if (placeholder) placeholder.remove();

    const now = new Date();
    const timeStr = now.toLocaleTimeString();

    let dataDisplay = "";
    if (payload instanceof Uint8Array || payload instanceof ArrayBuffer) {
        const bytes = new Uint8Array(payload);
        dataDisplay = "[" + Array.from(bytes).join(", ") + "]";
        
        // Pokud jsou to 4 bajty, je to pixel -> ukážeme ID
        if (bytes.length === 4) {
            dataDisplay += ` (LED ID:${bytes[0]} | RGB)`;
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

// --- MŘÍŽKA A VÝPOČTY ---
function createGrid() {
    const grid = document.getElementById('pixel-grid');
    if (!grid) return; 
    grid.innerHTML = ""; 

    // HTML Grid se generuje shora dolů (row 0 je nahoře)
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const cell = document.createElement('div');
            cell.classList.add('pixel-cell');
            
            // Přepočítáme HTML řádky na tvoje souřadnice (0:0 dole)
            const targetX = col;
            const targetY = 7 - row;

            cell.dataset.x = targetX;
            cell.dataset.y = targetY;

            cell.addEventListener('mousedown', (e) => {
                isDrawing = true;
                paintCell(e.target);
            });
            cell.addEventListener('mouseenter', (e) => {
                if (isDrawing) paintCell(e.target);
            });

            grid.appendChild(cell);
        }
    }
}

function paintCell(cell) {
    const colorPicker = document.getElementById('colorPicker');
    const colorInput = colorPicker ? colorPicker.value : "#ff0000";
    const rgb = hexToRgb(colorInput);
    
    cell.style.backgroundColor = colorInput;

    const x = parseInt(cell.dataset.x);
    const y = parseInt(cell.dataset.y);

    // --- VÝPOČET INDEXU LEDKY ---
    // Sloupce jdou zdola nahoru.
    // 1. sloupec (x=0) jsou indexy 0-7
    // 2. sloupec (x=1) jsou indexy 8-15
    const index = (x * 8) + y;

    // Posíláme 4 bajty: [Index, R, G, B]
    const payload = new Uint8Array([index, rgb.r, rgb.g, rgb.b]);

    sendMqttBinary(MQTT_TOPIC_GRID, payload);
}

function clearGrid() {
    // Příkaz CLEAR zůstává jako jeden bajt 255
    const payload = new Uint8Array([255]);
    
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