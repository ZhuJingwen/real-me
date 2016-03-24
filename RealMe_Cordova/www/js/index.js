/*
  BLE Sensor

  Read values from Maria Paula Saba's BLE Sensor service
  https://github.com/tigoe/BluetoothLE-Examples/blob/master/arduinoBLEperipheral/sensorExample/sensorExample.ino

*/
/* global startPage, deviceList, refreshButton */
/* global connectedPage, muscleValue, disconnectButton */
/* global ble  */
/* jshint browser: true , devel: true*/
'use strict';

var socket = io('http://159.203.71.216:8000/');

// ASCII only
function bytesToString(buffer) {
  return String.fromCharCode.apply(null, new Uint8Array(buffer));
}

// ASCII only
function stringToBytes(string) {
  var array = new Uint8Array(string.length);
  for (var i = 0, l = string.length; i < l; i++) {
    array[i] = string.charCodeAt(i);
  }
  return array.buffer;
}

// BLE service details
var sensor = {
  id: '12056A15-3D48-0883-DA8B-3498C2AD0AA6',
  service: '19b10000-e8f2-537e-4f6c-d104768a1214',
  muscle: '19b10001-e8f2-537e-4f6c-d104768a1214',
  pulse: '19b10002-e8f2-537e-4f6c-d104768a1214',
  bpm: '19b10003-e8f2-537e-4f6c-d104768a1214'
};

var bluefruit = {
  id: 'FF1E7CB7-1AB0-9A67-0C5E-AB904B0CA444',
  serviceUUID: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
  txCharacteristic: '6e400002-b5a3-f393-e0a9-e50e24dcca9e', // transmit is from the phone's perspective
  rxCharacteristic: '6e400003-b5a3-f393-e0a9-e50e24dcca9e' // receive is from the phone's perspective
};

var app = {
  initialize: function() {
    this.bindEvents(); //binding event listeners to DOM in the app
    connectedPage.hidden = true; //hides the HTML elements for the second page
    connectButton.hidden = true;
    socket.on('connect', function() {
      //console.log("connected");
    });
  },

  bindEvents: function() {
    document.addEventListener('deviceready', this.startSensor, false); //runs onDeviceReady function whenever the device is ready (loaded)
    refreshButton.addEventListener('touchstart', this.startSensor, false); //on touch of the Refresh button, runs refreshDeviceList function
    connectButton.addEventListener('touchstart', this.connectSensor, false); //on touch of device list, connect to device
    disconnectButton.addEventListener('touchstart', this.disconnectAll, false);
  },

  startSensor: function() {
    //console.log("startSensor");
    ble.scan([sensor.service], 15, app.startBluefruit, app.hideConnectButton);

  },
  startBluefruit: function() {
    //console.log("startBluefruit");

    ble.scan([bluefruit.serviceUUID], 5, app.showConnectButton, app.hideConnectButton);
  },
  showConnectButton: function(){
    connectButton.hidden = false;
  },
  hideConnectButton:function(){
  connectButton.hidden = true;
  },
  connectSensor: function() {
    //console.log("connectSensor");

    var onSensorConnect = function() {
      //console.log("startNotification");
      ble.read(sensor.id, sensor.service, sensor.muscle, app.onMuscleData, app.onSensorError);
      app.showConnectPage();

    };

    ble.isConnected(
      sensor.id,
      function() {
        //console.log("is connected");
      },
      function() {
        //console.log("is not connected");
        ble.connect(sensor.id, onSensorConnect, app.onSensorError);
      }
    );
  },
  onMuscleData: function(buffer) { // data received from Arduino
    //console.log("onMuscleData");
    var data = new Uint8Array(buffer);
    muscleValue.innerHTML = data[0];
    var muscleData = data[0];
    socket.emit('muscle', muscleData);
    ble.read(sensor.id, sensor.service, sensor.pulse, app.onPulseData, app.onSensorError);
  },
  onPulseData: function(buffer) { // data received from Arduino
    //console.log("onPulseData");
    // Create typed array from the ArrayBuffer
    var data = new Uint8Array(buffer);
    // get the integer value and set into the UI
    pulseValue.innerHTML = data[0];
    var pulseData = data[0];
    socket.emit('pulse', pulseData);
    ble.read(sensor.id,sensor.service,sensor.bpm,app.onBPMData,app.onSensorError);
  },
  onBPMData: function(buffer) { // data received from Arduino
    //console.log("onBPMData");
    // Create typed array from the ArrayBuffer
    var data = new Uint8Array(buffer);
    // get the integer value and set into the UI
    BPMValue.innerHTML = data[0];
    var BPMData = data[0];
    socket.emit('bpm', BPMData);
    app.switchToBluefruit();
  },
  switchToBluefruit: function() {
    //console.log("disconnectSensor");
    ble.disconnect(sensor.id, app.connectBluefruit, app.onSensorError);
  },

  connectBluefruit: function() {
    //console.log("connectBluefruit");
    var onConnect = function(peripheral) {
      app.determineWriteType(peripheral);
      ble.read(bluefruit.id, bluefruit.serviceUUID, bluefruit.rxCharacteristic, app.onBluefruitData, app.onError);
      app.sendBluefruitData();
    };
    ble.connect(bluefruit.id, onConnect, app.onBluefruitError);
  },
  sendBluefruitData: function() {
    //console.log("sendBluefruitData");

    var success = function() {
      //console.log("success");
    };

    var failure = function() {
      //console.log("Failed writing data to the bluefruit le");
      app.switchToSensor();
    };

    var data = stringToBytes("Hello");

    if (app.writeWithoutResponse) {
      ble.writeWithoutResponse(
        bluefruit.id,
        bluefruit.serviceUUID,
        bluefruit.txCharacteristic,
        data, success, failure
      );
    } else {
      ble.write(
        bluefruit.id,
        bluefruit.serviceUUID,
        bluefruit.txCharacteristic,
        data, success, failure
      );
    }
  },
  onBluefruitData: function(buffer) {
    //console.log("onBluefruitData");
    var data = new Uint8Array(buffer);
    var accelerometerData = data[0];
    socket.emit('accelerometer', accelerometerData);
    accelerometerValue.innerHTML = accelerometerData;
    app.switchToSensor();
    //console.log(accelerometerData);
  },
  switchToSensor: function() {
    ble.disconnect(bluefruit.id, app.connectSensor, app.onBluefruitError);
  },
  determineWriteType: function(peripheral) {
    var characteristic = peripheral.characteristics.filter(function(element) {
      if (element.characteristic.toLowerCase() === bluefruit.txCharacteristic) {
        return element;
      }
    })[0];

    if (characteristic.properties.indexOf('WriteWithoutResponse') > -1) {
      app.writeWithoutResponse = true;
    } else {
      app.writeWithoutResponse = false;
    }

  },
  disconnectAll: function() {
    ble.isConnected(sensor.id,function(){
      ble.isConnected(bluefruit.id,function(){
        //bluefruit is connected
        //sensor is connected
        //not gonna happen
      },function(){
        //bluefruit is not connected
        //sensor is connected
        ble.disconnect(sensor.id,app.showStartPage,app.onError);
      });
    },function(){
      ble.isConnected(bluefruit.id,function(){
        //bluefruit is connected
        //sensor is not connected
        ble.disconnect(bluefruit.id,app.showStartPage,app.onError);
      },function(){
        //bluefruit is not connected
        //sensor is not connected
        app.showStartPage();
      });
    });
  },
  showStartPage: function() {
    startPage.hidden = false;
    connectedPage.hidden = true;
  },

  showConnectPage: function() {
    startPage.hidden = true;
    connectedPage.hidden = false;
  },
  onError: function(reason) {
    //console.log("ERROR: " + reason); // real apps should use notification.alert
    app.switchToSensor();
  },
  onSensorError: function(reason) {
      //console.log("SENSOR ERROR: " + reason);
      app.switchToBluefruit();

  },
  onBluefruitError: function(reason) {
      //console.log("BLUEFRUIT ERROR: " + reason);
      app.switchToSensor();

  }
};

app.initialize();
