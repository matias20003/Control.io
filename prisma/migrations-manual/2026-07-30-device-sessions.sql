CREATE TABLE IF NOT EXISTS "DeviceSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "deviceType" TEXT NOT NULL,
  "browser" TEXT NOT NULL,
  "os" TEXT NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeviceSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeviceSession_userId_deviceId_key"
  ON "DeviceSession"("userId", "deviceId");

CREATE INDEX IF NOT EXISTS "DeviceSession_userId_lastSeenAt_idx"
  ON "DeviceSession"("userId", "lastSeenAt");
