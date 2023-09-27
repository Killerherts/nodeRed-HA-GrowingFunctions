// Get the Home Assistant object
const d = global.get('homeassistant').homeAssistant;
let side2Rh = d.states["sensor.grow_side2_table_humidity_rh"].state;
let requiredRh = d.states["sensor.required_rh_for_desired_kpa_side_2"].state;
let humidifierState = d.states["switch.garden_humidifier"].state;
let delta = 1;
let debugMode = true;

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

// Check if the humidity difference is less than or equal to -delta (below required level)
if (requiredRh - side2Rh >= delta) {
    // Create an object with service, domain, and entity_id
    const payload = {
        service: 'turn_on',
        domain: 'switch',
        entity_id: 'switch.garden_humidifier'
    };

    // Set the msg.payload to the created object
    msg.payload = payload;

    // Send the message to the next node in the flow
    return msg;
} else if (side2Rh >= requiredRh) {
    // Create an object with service, domain, and entity_id
    const payload = {
        service: 'turn_off',
        domain: 'switch',
        entity_id: 'switch.garden_humidifier'
    };

    // Set the msg.payload to the created object
    msg.payload = payload;

    // Send the message to the next node in the flow
    return msg;
} else {
    // Log a debug message indicating no action was taken
    logDebug('Humidifier', 'No action taken');
}


// Log the variables using logDebug
logDebug('side2Rh', side2Rh);
logDebug('requiredRh', requiredRh);
logDebug('humidifierState', humidifierState);
logDebug('delta', delta);
logDebug('debugMode', debugMode);
logDebug('rh - required', (side2Rh - requiredRh))
