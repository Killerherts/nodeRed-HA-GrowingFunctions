const HA_CONFIG = {
    homeAssistantObject: 'homeassistant.homeAssistant',
    flipStartedEntity: 'input_boolean.side1_filp_to_flower',
    switchStateEntity: 'switch.side_1_grow_light',
    lightsOnTimeEntity: 'input_datetime.side_1_lights_on_time',
    lightControlEntity: 'switch.side_1_grow_light',
    serviceDomain: 'switch'
};

// Fetch the Home Assistant object and states
const d = global.get(HA_CONFIG.homeAssistantObject);
let flipStarted = d.states[HA_CONFIG.flipStartedEntity].state;
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
    // Get the current date and time
    const currentDate = new Date();

    // Extract hours, minutes, and seconds
    const currentHours = currentDate.getHours();
    const currentMinutes = currentDate.getMinutes();
    const currentSeconds = currentDate.getSeconds();

// Calculate the total seconds
    const currentTime = (currentHours * 3600) + (currentMinutes * 60) + currentSeconds;


    // Parse time to seconds
    let lightsOnTimeInSeconds = parseTimeToSeconds(lightsOnTime);

    // Calculate lightsOffTimeInSeconds based on flipStarted
    let lightsOffTimeInSeconds;
    if (flipStarted) {
        lightsOffTimeInSeconds = lightsOnTimeInSeconds + (12 * 3600);
    } else {
        lightsOffTimeInSeconds = lightsOnTimeInSeconds + (18 * 3600);
    }

    // Ensure lightsOffTimeInSeconds doesn't exceed 24 hours
    lightsOffTimeInSeconds = lightsOffTimeInSeconds % (24 * 3600);

    // Debugging: Log the values of lightsOnTimeInSeconds, lightsOffTimeInSeconds, and flipStarted
    logDebug('lightsOnTimeInSeconds:', lightsOnTimeInSeconds);
    logDebug('lightsOffTimeInSeconds:', lightsOffTimeInSeconds);
    logDebug('flipStarted:', flipStarted);
    logDebug('current time ', currentTime);
    logDebug('Switch State: ', switchState);

    if (lightsOnTimeInSeconds < lightsOffTimeInSeconds) {
        // Lights come on and go off on the same day
        if (currentTime >= lightsOnTimeInSeconds && currentTime < lightsOffTimeInSeconds) {
            // Within the time range and switch is off, turn on the lights
            if (switchState == 'off') {
                msg.payload = {
                    service_domain: HA_CONFIG.serviceDomain,
                    service: 'turn_on',
                    entity_id: HA_CONFIG.lightControlEntity
                };
                // Debugging: Log that the lights are being turned on
                logDebug('Turning on the lights', '');
                node.send(msg);
                return msg;
            }
        } else {
            // Outside the time range or switch is already on, turn off the lights
            if (switchState == 'on') {
                msg.payload = {
                    service_domain: HA_CONFIG.serviceDomain,
                    service: 'turn_off',
                    entity_id: HA_CONFIG.lightControlEntity
                };
                // Debugging: Log that the lights are being turned off
                logDebug('Turning off the lights', '');
                node.send(msg);
                return msg;
            }
        }
    } else {
        // Lights come on before midnight and go off after midnight
        if (currentTime >= lightsOnTimeInSeconds || currentTime < lightsOffTimeInSeconds) {
            // Within the time range and switch is off, turn on the lights
            if (switchState == 'off') {
                
                msg.payload = {
                    service_domain: HA_CONFIG.serviceDomain,
                    service: 'turn_on',
                    entity_id: HA_CONFIG.lightControlEntity
                };
                // Debugging: Log that the lights are being turned on
                logDebug('Turning on the lights', '');
                node.send(msg);
                return msg;
            }
        } else {
            // Outside the time range or switch is already on, turn off the lights
            if (switchState == 'on') {
                msg.payload = {
                    service_domain: HA_CONFIG.serviceDomain,
                    service: 'turn_off',
                    entity_id: HA_CONFIG.lightControlEntity
                };
                // Debugging: Log that the lights are being turned off
                logDebug('Turning off the lights', '');
                node.send(msg);
                return msg;
            }
        }
    }
}

    // No action needed, switch is already in the desired position
    // Debugging: Log that no action is needed
logDebug('No action needed');


// Call the calculateLightsControl function to perform the lights control logic
calculateLightsControl();
