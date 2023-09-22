// Define a global variable for debug logging
var debugMode = false;

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
    var currentTime = new Date().getTime() / 1000; // Get current time in seconds
    var flipStarted = msg.flipState;
    var switchState = msg.switchState; // Get the current state of the switch
    var lightsOnTimeInSeconds = parseTimeToSeconds(msg.lightOn);
    var lightsOffTimeInSeconds;

    // Calculate lightsOffTimeInSeconds based on flipStarted
    if (flipStarted == 'on') {
        // Flip switch is on, so lights are off for 12 hours
        lightsOffTimeInSeconds = lightsOnTimeInSeconds + 12 * 3600;
    } else {
        // Flip switch is off, so lights are off for 18 hours
        lightsOffTimeInSeconds = lightsOnTimeInSeconds + 18 * 3600;
    }

    // Debugging: Log the values of lightsOnTimeInSeconds, lightsOffTimeInSeconds, currentTime, and flipStarted
    logDebug('lightsOnTimeInSeconds:', lightsOnTimeInSeconds);
    logDebug('lightsOffTimeInSeconds:', lightsOffTimeInSeconds);
    logDebug('currentTime:', currentTime);
    logDebug('flipStarted:', flipStarted);

    if (lightsOnTimeInSeconds < lightsOffTimeInSeconds) {
        // Lights come on and go off on the same day
        if (currentTime >= lightsOnTimeInSeconds && currentTime < lightsOffTimeInSeconds) {
            // Within the time range and switch is off, turn on the lights
            if (switchState == 'off') {
                msg.payload = {
                    service_domain: 'homeassistant',
                    service: 'turn_on',
                    entity_id: 'switch.600_rspec'
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
                    service_domain: 'homeassistant',
                    service: 'turn_off',
                    entity_id: 'switch.600_rspec'
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
                    service_domain: 'homeassistant',
                    service: 'turn_on',
                    entity_id: 'switch.600_rspec'
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
                    service_domain: 'homeassistant',
                    service: 'turn_off',
                    entity_id: 'switch.600_rspec'
                };
                // Debugging: Log that the lights are being turned off
                logDebug('Turning off the lights', '');
                node.send(msg);
                return msg;
            }
        }
    }

    // No action needed, switch is already in the desired position
    // Debugging: Log that no action is needed
    logDebug('No action needed');
}

// Call the calculateLightsControl function to perform the lights control logic
calculateLightsControl();
