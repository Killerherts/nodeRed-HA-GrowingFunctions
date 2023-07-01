const currentRh = msg.rh;
const requiredRh = msg.req_rh;
const currentTemp = msg.temp;
const desiredTemp = msg.desiredTemperature;
const currentBrightness = msg.brightness;

// node.warn("current brightness: " + currentBrightness + ", current rh: " + currentRh + ', current temp: ' + currentTemp);

const maxBrightness = 255;
const minBrightness = 1;
const brightnessScaling = 8;

let brightnessAdjustment = brightnessScaling;

if (currentTemp > desiredTemp || currentRh > requiredRh) {
    // Either temperature or humidity is above desired level
    msg.brightness = Math.min(currentBrightness + brightnessAdjustment, maxBrightness);
    if (msg.brightness !== currentBrightness) {
        node.warn("Either temperature or humidity is above desired level. Increasing brightness by brightness scaling. New Level is " + Math.round((msg.brightness / maxBrightness) * 100));
        msg.payload = msg.brightness;
        return msg;
    }
} else if (currentTemp < desiredTemp && currentRh < requiredRh && currentBrightness !== Math.max(currentBrightness - (brightnessAdjustment * 2), minBrightness)) {
    // Both temperature and humidity are below desired levels
    msg.brightness = Math.max(currentBrightness - (brightnessAdjustment * 2), minBrightness);
    if (msg.brightness !== currentBrightness) {
        node.warn("Both temperature and humidity are below desired levels. Decreasing brightness by brightness scaling. New Brightness is " + Math.round((msg.brightness / maxBrightness) * 100));
        msg.payload = msg.brightness;
        return msg;
    }
} else {
    // No action required
    node.warn("No action required. Keeping the brightness unchanged.");
}
