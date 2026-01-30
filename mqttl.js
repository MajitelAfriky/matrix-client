// --- KONFIGURACE MQTT (Z tvého index.html) ---
const MQTT_HOST = "6b21f01c6a0e4cc08a8ae8d7acbcecb5.s1.eu.hivemq.cloud";
const MQTT_PORT = 8884;
const MQTT_USER = "web-client";
const MQTT_PASS = "Lolopolo123"; 

const MQTT_TOPIC_CMD = "light";       // Téma pro tlačítka
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
    
    // 3. Globální listener pro ukončení kreslení (když pustíš myš i mimo mřížku)
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

function sendMqttBinary(topic, buffer) {
    if (!client.isConnected()) return;

    // Paho MQTT pozná, že mu dáváš buffer (ArrayBuffer/TypedArray)
    const message = new Paho.MQTT.Message(buffer);
    message.destinationName = topic;
    client.send(message); 
}

// --- LOGIKA MŘÍŽKY ---
function createGrid() {
    const grid = document.getElementById('pixel-grid');
    if (!grid) return; // Ochrana kdyby element neexistoval

    grid.innerHTML = ""; 

    // Generujeme 8 řádků (HTML row 0 je nahoře)
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const cell = document.createElement('div');
            cell.classList.add('pixel-cell');
            
            // Přepočet souřadnic: Chceme 0:0 vlevo dole
            // HTML Row 0 (nahoře) -> Y = 7
            // HTML Row 7 (dole)   -> Y = 0
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
    const colorInput = document.getElementById('colorPicker').value;
    const rgb = hexToRgb(colorInput);
    
    // Získáme souřadnice jako čísla (ne stringy!)
    const x = parseInt(cell.dataset.x);
    const y = parseInt(cell.dataset.y);

    // Vytvoříme binární pole o velikosti 5 bajtů
    // Pořadí: [X, Y, R, G, B]
    const payload = new Uint8Array([x, y, rgb.r, rgb.g, rgb.b]);

    // Odeslání
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
// --- script.js ---

// Funkce pro vyčištění mřížky
function clearGrid() {
    // Pro clear pošleme jen jeden bajt s hodnotou 255
    const payload = new Uint8Array([255]);
    
    // ... vizuální reset buněk ...
    
    sendMqttBinary(MQTT_TOPIC_GRID, payload);
}
// --- script.js ---

// 1. Upravíme existující funkci sendMqttMessage
// (Najdi ji v kódu a nahraď ji touto verzí)
function sendMqttMessage(topic, payload) {
    if (!client.isConnected()) {
        console.log("MQTT není připojeno, zpráva neodeslána");
        updateStatus("Chyba: Nepřipojeno!", "red");
        return;
    }

    // Odeslání MQTT
    const message = new Paho.MQTT.Message(payload);
    message.destinationName = topic;
    client.send(message); 
    
    // NOVÉ: Zavolání logování do HTML
    logToConsole(payload);
}

// 2. Přidáme novou funkci pro formátování a výpis
function logToConsole(payload) {
    const consoleBox = document.getElementById('console-log');
    if (!consoleBox) return;

    // Odstraníme placeholder "Zatím žádná data...", pokud tam je
    const placeholder = consoleBox.querySelector('.log-placeholder');
    if (placeholder) placeholder.remove();

    // Zjistíme aktuální čas
    const now = new Date();
    const timeStr = now.toLocaleTimeString();

    // Převedeme binární payload na čitelný text
    // Pokud je to Uint8Array (což u pixelů je), převedeme na pole čísel [0, 0, 255...]
    let dataDisplay = "";
    if (payload instanceof Uint8Array || payload instanceof ArrayBuffer) {
        // Magie: převedeme bajty na seznam čísel oddělený čárkou
        const bytes = new Uint8Array(payload);
        dataDisplay = "[" + Array.from(bytes).join(", ") + "]";
        
        // Pokud je to pixel (5 bajtů), můžeme přidat vysvětlivku
        if (bytes.length === 5) {
            dataDisplay += ` (X:${bytes[0]} Y:${bytes[1]} RGB)`;
        } else if (bytes.length === 1 && bytes[0] === 255) {
            dataDisplay += " (CLEAR)";
        }
    } else {
        // Pokud bys náhodou poslal text
        dataDisplay = payload.toString();
    }

    // Vytvoříme HTML element pro řádek
    const entry = document.createElement('div');
    entry.classList.add('log-entry');
    entry.innerHTML = `<span class="log-time">${timeStr}</span> <span class="log-data">${dataDisplay}</span>`;

    // Přidáme na začátek (nejnovější nahoře)
    consoleBox.prepend(entry);
}

// 3. Funkce pro tlačítko "Smazat log"
function clearLog() {
    const consoleBox = document.getElementById('console-log');
    consoleBox.innerHTML = '<div class="log-placeholder">Log vymazán...</div>';
}