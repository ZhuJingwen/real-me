/*
  Sensor reading

  Uses Sandeep Mistry's BLE Peripheral library: https://github.com/sandeepmistry/arduino-BLEPeripheral/
  to read data from a sensor.

  created 6 Feb 2015
  by Maria Paula Saba
*/


// Import libraries (BLEPeripheral depends on SPI)
#include <SPI.h>
#include <BLEPeripheral.h>

// define pins (varies per shield/board, UNUSED for nRF51822)
#define BLE_REQ   6
#define BLE_RDY   7
#define BLE_RST   4

//define sensor pin
#define SENSOR_PIN 0
int pulsePin = 1;

//variable for a timer
long previousMillis = 0;

// interval at which we change (send) data (milliseconds)
long interval = 100;

// create peripheral instance, see pinouts above
BLEPeripheral           blePeripheral        = BLEPeripheral(BLE_REQ, BLE_RDY, BLE_RST);

// create service
BLEService              sensorService           = BLEService("19b10000-e8f2-537e-4f6c-d104768a1214");

// create switch characteristic
BLECharCharacteristic   muscleCharacteristic = BLECharCharacteristic("19b10001-e8f2-537e-4f6c-d104768a1214", BLERead | BLENotify);
BLECharCharacteristic   pulseCharacteristic = BLECharCharacteristic("19b10002-e8f2-537e-4f6c-d104768a1214", BLERead | BLENotify);
BLECharCharacteristic   bpmCharacteristic = BLECharCharacteristic("19b10003-e8f2-537e-4f6c-d104768a1214", BLERead | BLENotify);

// these variables are volatile because they are used during the interrupt service routine!
volatile int BPM;                   // used to hold the pulse rate
volatile int Signal;                // holds the incoming raw data
volatile int IBI = 600;             // holds the time between beats, the Inter-Beat Interval
volatile boolean Pulse = false;     // true when pulse wave is high, false when it's low
volatile boolean QS = false;        // becomes true when Arduoino finds a beat.

void setup() {
  Serial.begin(115200);
#if defined (__AVR_ATmega32U4__)
  delay(5000);  //5 seconds delay for enabling to see the start up comments on the serial board
#endif

  //set sensor pin
  pinMode(SENSOR_PIN, INPUT);
  interruptSetup();

  // set advertised local name and service UUID
  blePeripheral.setLocalName("Sensor");
  blePeripheral.setAdvertisedServiceUuid(sensorService.uuid());

  // add service and characteristic
  blePeripheral.addAttribute(sensorService);
  blePeripheral.addAttribute(muscleCharacteristic);
  blePeripheral.addAttribute(pulseCharacteristic);
  blePeripheral.addAttribute(bpmCharacteristic);

  // assign event handlers for connected, disconnected to peripheral
  blePeripheral.setEventHandler(BLEConnected, blePeripheralConnectHandler);
  blePeripheral.setEventHandler(BLEDisconnected, blePeripheralDisconnectHandler);

  // assign event handlers for characteristic
  muscleCharacteristic.setEventHandler(BLESubscribed, characteristicSubscribed);
  muscleCharacteristic.setEventHandler(BLEUnsubscribed, characteristicUnsubscribed);

  // begin initialization
  blePeripheral.begin();

  Serial.println(F("BLE Sensor Peripheral"));
}

void loop() {
  // poll peripheral - this function will start the peripheral and handle the callbacks
  blePeripheral.poll();

  //timer function
  unsigned long currentMillis = millis();
  if (currentMillis - previousMillis > interval) {
    // save the last time
    previousMillis = currentMillis;

    // read the analog input
    int analogValue = analogRead(SENSOR_PIN);
    //Serial.print("muscle ");
    //Serial.println(analogValue);

    //save it in the characteristic
    muscleCharacteristic.setValue(analogValue);

    //Serial.println(analogValue);

    //    pulseCharacteristic.setValue(Signal);
    pulseCharacteristic.setValue(Signal);
    bpmCharacteristic.setValue(BPM);
    if (QS == true) {                      // Quantified Self flag is true when arduino finds a heartbeat
      Serial.print("S=");
      Serial.print(Signal);
      Serial.print(",B=");
      Serial.print(BPM);   // send heart rate with a 'B' prefix
      Serial.print(",Q=");
      Serial.println(IBI);   // send time between beats with a 'Q' prefix

      QS = false;                      // reset the Quantified Self flag for next time
    }

  }

}

//callback functions for connect, disconnect and written characteristic are described below:
void blePeripheralConnectHandler(BLECentral& central) {
  // central connected event handler
  Serial.print(F("Connected vent, central: "));
  Serial.println(central.address());

}

void blePeripheralDisconnectHandler(BLECentral& central) {
  // central disconnected event handler
  Serial.print(F("Disconnected event, central: "));
  Serial.println(central.address());
}


void characteristicSubscribed(BLECentral& central, BLECharacteristic& characteristic) {
  // characteristic subscribed event handler
  Serial.println(F("Characteristic event, subscribed"));
}

void characteristicUnsubscribed(BLECentral& central, BLECharacteristic& characteristic) {
  // characteristic unsubscribed event handler
  Serial.println(F("Characteristic event, unsubscribed"));
}

