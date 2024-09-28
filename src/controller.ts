import noble from "@stoprocent/noble";
import { ConnectState, DataListener } from "./start";
import { sendMessage } from "./communication";
import { bitmask, delay, hex } from "./util";
import { lock } from "./lock";

const STEP_FACTOR = 10000;
export const MAX_SPEED = 0x7fff;

export interface MotorDrivePositionOptions {
  motor: Motor;
  target: DrivePositionOptions;
}

export interface DrivePositionOptions {
  speed: number;
  position: number;
}

export enum Direction {
  Right = "R",
  Left = "L",
}

export enum Motor {
  A = 1,
  B,
  C,
  D,
}

export async function createController(
  characteristic: noble.Characteristic,
  connectState: ConnectState,
  registerDataListener: (listener: DataListener) => void,
  options?: MKH40ControllerOptions
): Promise<MKH40Controller> {
  await sendMessage(characteristic, "T041AABBW");
  await sendMessage(characteristic, "T00EW");
  await sendMessage(characteristic, "T01F1W");

  const backgroundJob = async () => {
    while (connectState.connected) {
      await sendMessage(characteristic, "T00CW");
      await delay(2000);
    }
  };
  backgroundJob();

  return new MKH40Controller(characteristic, registerDataListener, options);
}

interface DriveOptions {
  speed: number;
  direction: Direction;
  limit: boolean;
}

interface MotorDriveOptions extends DriveOptions {
  motor: Motor;
}

export interface MKH40ControllerOptions {
  log: boolean;
}
export class MKH40Controller {
  private listeners: {
    message: string;
    callback: (message: string) => void;
  }[] = [];

  private ready: Promise<void>;

  constructor(
    private characteristic: noble.Characteristic,
    registerDataListener: (listener: DataListener) => void,
    private options: MKH40ControllerOptions = { log: true }
  ) {
    registerDataListener((data, isNotification) => {
      const received = data.toString("ascii");

      const messages = received
        .split("W")
        .filter(Boolean)
        .map((m) => m + "W");

      for (const message of messages) {
        if (options.log) {
          console.log(`notification:${isNotification} => ${message}`);
        }

        let found = false;
        for (let i = this.listeners.length - 1; i >= 0; i--) {
          const listener = this.listeners[i];
          if (message.startsWith(listener.message)) {
            found = true;
            this.listeners.splice(i, 1);
            listener.callback(message);
          }
        }
        if (options.log && !found) {
          console.log(`=> No listener found for message ${message}.`);
        }
        return sendMessage(this.characteristic, [1], this.options);
      }
    });

    // wait for "ready" notification
    this.ready = new Promise((resolve) => {
      this.addListener("T", () => resolve());
    });
  }

  private addListener(
    messagePrefix: string,
    callback: (message: string) => void
  ) {
    this.listeners.push({ message: messagePrefix, callback });
  }

  public stopAll() {
    return sendMessage(
      this.characteristic,
      "T14400000000000000000000W",
      this.options
    );
  }

  private getDriveOptions(
    motor: Motor,
    motorDriveOptions: MotorDriveOptions[]
  ): DriveOptions {
    const found = motorDriveOptions.find((s) => s.motor === motor);
    return found || { direction: Direction.Right, speed: 0, limit: false };
  }

  public async driveMotor(motorDriveOptions: MotorDriveOptions[]) {
    await this.ready;

    const motorA = this.getDriveOptions(Motor.A, motorDriveOptions);
    const motorB = this.getDriveOptions(Motor.B, motorDriveOptions);
    const motorC = this.getDriveOptions(Motor.C, motorDriveOptions);
    const motorD = this.getDriveOptions(Motor.D, motorDriveOptions);

    return sendMessage(
      this.characteristic,
      `T144${this.writeDriveOptionsToMessage(
        motorA
      )}${this.writeDriveOptionsToMessage(
        motorB
      )}${this.writeDriveOptionsToMessage(
        motorC
      )}${this.writeDriveOptionsToMessage(motorD)}W`,
      this.options
    );
  }

  public async setLimits(
    motor: Motor,
    negativeLimit: number,
    positiveLimit: number
  ) {
    await this.ready;

    negativeLimit *= STEP_FACTOR;
    positiveLimit *= STEP_FACTOR;

    const message = `T149${bitmask([motor], 2)}${
      positiveLimit >= 0 ? "+" : "-"
    }${hex(positiveLimit, 8)}${negativeLimit >= 0 ? "+" : "-"}${hex(
      negativeLimit,
      8
    )}W`;
    return sendMessage(this.characteristic, message, this.options);
  }

  private validateSpeedAndDirection(motor: DriveOptions) {
    if (motor.speed < 0) {
      throw Error(`Speed must not be a negative value: ${motor.speed}`);
    }

    if (motor.speed > 0x7fff) {
      throw Error(`Max speed exceeded: 0x${hex(motor.speed, 0)} > 0x7FFF`);
    }
  }

  private writeDriveOptionsToMessage(motor: DriveOptions) {
    this.validateSpeedAndDirection(motor);

    let speed = Math.round(motor.speed);

    if (motor.direction === Direction.Left) {
      speed += 0x8000;
    }

    return motor.limit ? "1" : "0" + hex(speed, 4);
  }

  private validateSpeedAndPosition(motor: DrivePositionOptions) {
    if (motor.speed < 0) {
      throw Error(`Speed must not be a negative value: ${motor.speed}`);
    }

    if (motor.speed > 0x7fff) {
      throw Error(`Max speed exceeded: 0x${hex(motor.speed, 0)} > 0x7FFF`);
    }
  }

  private writeDrivePositionOptionsToMessage(target: DrivePositionOptions) {
    this.validateSpeedAndPosition(target);

    const targetPosition = Math.round(target.position * STEP_FACTOR);
    let speed = Math.round(target.speed);

    if (targetPosition >= 0) {
      speed += 0x8000;
    }

    return hex(speed, 4) + hex(Math.abs(targetPosition), 8);
  }

  private getDrivePositionOptions(
    motor: Motor,
    motorDrivePositionOptions: MotorDrivePositionOptions[]
  ): DrivePositionOptions {
    return (
      motorDrivePositionOptions.find((t) => t.motor === motor)?.target || {
        position: 0,
        speed: 0,
      }
    );
  }

  public async driveMotorToPosition(
    motorDrivePositionOptions: MotorDrivePositionOptions[],
    options = { pollForMotorToReachPosition: false }
  ): Promise<void> {
    await this.ready;

    const motorA = this.getDrivePositionOptions(
      Motor.A,
      motorDrivePositionOptions
    );
    const motorB = this.getDrivePositionOptions(
      Motor.B,
      motorDrivePositionOptions
    );
    const motorC = this.getDrivePositionOptions(
      Motor.C,
      motorDrivePositionOptions
    );
    const motorD = this.getDrivePositionOptions(
      Motor.D,
      motorDrivePositionOptions
    );

    await lock.acquire(`drive`, async () => {
      const message = `T303${this.writeDrivePositionOptionsToMessage(
        motorA
      )}${this.writeDrivePositionOptionsToMessage(
        motorB
      )}${this.writeDrivePositionOptionsToMessage(
        motorC
      )}${this.writeDrivePositionOptionsToMessage(motorD)}W`;

      const ret: Promise<void> = new Promise((resolve) => {
        this.addListener("T027300W", () => resolve());
      });

      await sendMessage(this.characteristic, message, this.options);
      await ret;

      if (options.pollForMotorToReachPosition) {
        await this.pollForMotorToReachPosition([
          { motor: Motor.A, sp: motorA },
          { motor: Motor.B, sp: motorB },
          { motor: Motor.C, sp: motorC },
          { motor: Motor.D, sp: motorD },
        ]);
      }
    });
  }

  private async pollForMotorToReachPosition(
    expected: { motor: Motor; sp: DrivePositionOptions }[]
  ) {
    expected = expected.filter((e) => e.sp.speed > 0);
    do {
      const targetPos = expected.map((e) => Math.round(e.sp.position));
      const motors = expected.map((e) => e.motor);
      console.log(`Wait for motor ${motors} to reach position ${targetPos}`);

      const cp = await this.getCurrentPositions(...motors);
      for (let i = expected.length - 1; i >= 0; i--) {
        if (cp[i] <= targetPos[i] + 1 && cp[i] >= targetPos[i] - 1) {
          const reached = expected.splice(i, 1);
          console.log(
            `Reached: motor ${reached[0].motor} at position ${cp[i]}`
          );
        }
      }
    } while (expected.length > 0);
  }

  public async resetMotorPosition(...motor: Motor[]) {
    await this.ready;

    return Promise.all(
      motor.map((m) =>
        sendMessage(
          this.characteristic,
          `T028${bitmask([m], 2)}W`,
          this.options
        )
      )
    );
  }

  public async getCurrentPositions(...motors: Motor[]): Promise<number[]> {
    await this.ready;

    const motorPrefixes = motors.map((motor) => `T0A7A${hex(motor, 1)}`);
    return await lock.acquire(
      motorPrefixes.map((motorPrefix) => `cp_${motorPrefix}`),
      async () => {
        const ret: Promise<number>[] = motorPrefixes.map(
          (motorPrefix) =>
            new Promise((resolve) => {
              this.addListener(motorPrefix, (message) => {
                const position = Math.round(
                  Number.parseInt(message.substring(6), 16) / STEP_FACTOR
                );
                resolve(position);
              });
            })
        );

        await sendMessage(
          this.characteristic,
          `T02A${bitmask(motors, 2)}W`,
          this.options
        );
        return Promise.all(ret);
      }
    );
  }
}
