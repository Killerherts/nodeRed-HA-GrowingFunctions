const HA_CONFIG = {
    homeAssistantObject: 'homeassistant.homeAssistant',
    darkHoursEntity: 'input_number.side_1_dark_hours',
    switchStateEntity: 'switch.side_1_grow_light',
    lightsOnTimeEntity: 'input_datetime.side_1_lights_on_time',
    lightControlEntity: 'switch.side_1_grow_light',
    serviceDomain: 'switch'
};

// Fetch the Home Assistant object and states
const d = global.get(HA_CONFIG.homeAssistantObject);
let darkHours = parseFloat(d.states[HA_CONFIG.darkHoursEntity].state);
let switchState = d.states[HA_CONFIG.switchStateEntity].state;
let lightsOnTime = d.states[HA_CONFIG.lightsOnTimeEntity].state;
let debugMode = false;

// Function to log debug messages with labels
function logDebug(label, value) {
    if (debugMode) {
        node.warn(label + ' ' + value);
    }
}

// Function to toggle debug mode on/off
function toggleDebugMode() {
    debugMode = !debugMode;
    if (debugMode) {
        node.warn('Debug mode is ON');
    } else {
        node.warn('Debug mode is OFF');
    }
}

// Function to parse time in HH:mm:ss format to seconds
function parseTimeToSeconds(timeStr) {
    var parts = timeStr.split(':');
    if (parts.length === 3) {
        var hours = parseInt(parts[0]);
        var minutes = parseInt(parts[1]);
        var seconds = parseInt(parts[2]);
        return hours * 3600 + minutes * 60 + seconds;
    } else {
        // Handle invalid time format if needed
        node.error('Invalid time format in msg.lightOn');
        return 0; // Return 0 as a fallback
    }
}

// Function to calculate the lights control logic
function calculateLightsControl() {
    const currentDate = new Date();
    const currentHours = currentDate.getHours();
    const currentMinutes = currentDate.getMinutes();
    const currentSeconds = currentDate.getSeconds();
    const currentTime = (currentHours * 3600) + (currentMinutes * 60) + currentSeconds;
    let lightsOnTimeInSeconds = parseTimeToSeconds(lightsOnTime);
    let lightsOffTimeInSeconds = lightsOnTimeInSeconds + ((24 - darkHours) * 3600);

    if (lightsOffTimeInSeconds >= 86400) {
        lightsOffTimeInSeconds -= 86400;
    }
    
    logDebug('lightsOnTimeInSeconds:', lightsOnTimeInSeconds);
    logDebug('lightsOffTimeInSeconds:', lightsOffTimeInSeconds);
    logDebug('darkHours:', darkHours);
    logDebug('current time ', currentTime);
    logDebug('Switch State: ', switchState);

    if (lightsOnTimeInSeconds < lightsOffTimeInSeconds) {
        if (currentTime >= lightsOnTimeInSeconds && currentTime < lightsOffTimeInSeconds) {
            if (switchState == 'off') {
                return turnOnLights();
            }
        } else {
            if (switchState == 'on') {
                return turnOffLights();
            }
        }
    } else {
        if (currentTime >= lightsOnTimeInSeconds || currentTime < lightsOffTimeInSeconds) {
            if (switchState == 'off') {
                return turnOnLights();
            }
        } else {
            if (switchState == 'on') {
                return turnOffLights();
            }
        }
    }
    
    logDebug('No action needed', '');
}

function turnOnLights() {
    msg.payload = {
        service_domain: HA_CONFIG.serviceDomain,
        service: 'turn_on',
        entity_id: HA_CONFIG.lightControlEntity
    };
    logDebug('Turning on the lights', '');
    return node.send(msg);
}

function turnOffLights() {
    msg.payload = {
        service_domain: HA_CONFIG.serviceDomain,
        service: 'turn_off',
        entity_id: HA_CONFIG.lightControlEntity
    };
    logDebug('Turning off the lights', '');
    return node.send(msg);
}

// Call the calculateLightsControl function to perform the lights control logic
calculateLightsControl();
