import { Direction, MKH40Controller, Motor } from "./controller";
import { initializeMKHController } from "./start";
import { delay } from "./util";

const VOLLE_GESCHWINDIGKEIT = 0x7fff;
const HALBE_GESCHWINDIGKEIT = 0x7fff / 2;
const VIERTEL_GESCHWINDIGKEIT = 0x7fff / 4;
const LENK_GESCHWINDIGKEIT = 0x7fff / 16;

const Putzmotor = Motor.A;
const Antriebsmotor = Motor.B;
const Lenkungsmotor = Motor.C;

function linksLenken(controller: MKH40Controller) {
  return controller.driveMotorToPosition(
    [
      {
        motor: Lenkungsmotor,
        target: {
          speed: LENK_GESCHWINDIGKEIT,
          position: 10,
        },
      },
    ],
    { pollForMotorToReachPosition: true }
  );
}

function rechtsLenken(controller: MKH40Controller) {
  return controller.driveMotorToPosition(
    [
      {
        motor: Lenkungsmotor,
        target: {
          speed: LENK_GESCHWINDIGKEIT,
          position: -10,
        },
      },
    ],
    { pollForMotorToReachPosition: true }
  );
}

function geradeausLenken(controller: MKH40Controller) {
  return controller.driveMotorToPosition(
    [
      {
        motor: Lenkungsmotor,
        target: {
          speed: LENK_GESCHWINDIGKEIT,
          position: 0,
        },
      },
    ],
    { pollForMotorToReachPosition: true }
  );
}

export async function start(controller: MKH40Controller) {
  await delay(10000000);
  await controller.resetMotorPosition(Motor.A, Motor.B, Motor.C, Motor.D);

  const PutzmotorOptionen = {
    motor: Putzmotor,
    direction: Direction.Left,
    limit: false,
    speed: VIERTEL_GESCHWINDIGKEIT,
  };
  await controller.driveMotor([PutzmotorOptionen]);
  await delay(5000);

  const RAMP_UP_TIME_S = 3;
  let Antriebsoptionen = {
    motor: Antriebsmotor,
    direction: Direction.Right,
    limit: false,
    speed: 0,
  };
  for (let s = 1; s <= RAMP_UP_TIME_S; s++) {
    Antriebsoptionen = {
      motor: Antriebsmotor,
      direction: Direction.Right,
      limit: false,
      speed: (VIERTEL_GESCHWINDIGKEIT * s) / RAMP_UP_TIME_S,
    };
    await controller.driveMotor([Antriebsoptionen, PutzmotorOptionen]);
    await delay(1000);
  }
  await delay(6000);

  //Kurve links
  await linksLenken(controller);
  await controller.driveMotor([Antriebsoptionen, PutzmotorOptionen]);
  await delay(6000);

  // Rückwärts
  await geradeausLenken(controller);
  Antriebsoptionen.direction = Direction.Left;
  await controller.driveMotor([Antriebsoptionen, PutzmotorOptionen]);
  await delay(5000);

  //Kurve links
  await linksLenken(controller);
  Antriebsoptionen.direction = Direction.Right;
  await controller.driveMotor([Antriebsoptionen, PutzmotorOptionen]);
  await delay(6000);

  //Geradeaus
  await geradeausLenken(controller);
  await controller.driveMotor([Antriebsoptionen, PutzmotorOptionen]);
  await delay(6000);

  // Kurve rechts
  await rechtsLenken(controller);
  await controller.driveMotor([Antriebsoptionen, PutzmotorOptionen]);
  await delay(6000);

  // Rückwärts
  await geradeausLenken(controller);
  Antriebsoptionen.direction = Direction.Left;
  await controller.driveMotor([Antriebsoptionen, PutzmotorOptionen]);
  await delay(5000);

  // Kurve rechts
  await rechtsLenken(controller);
  Antriebsoptionen.direction = Direction.Right;
  await controller.driveMotor([Antriebsoptionen, PutzmotorOptionen]);
  await delay(6000);

  //Geradeaus
  await geradeausLenken(controller);
  await controller.driveMotor([Antriebsoptionen, PutzmotorOptionen]);
  await delay(6000);

  await controller.stopAll();
}

console.log("Starting...")
initializeMKHController(start);
