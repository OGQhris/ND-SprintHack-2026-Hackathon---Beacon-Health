-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceSheet" TEXT NOT NULL,
    "sourceRow" INTEGER NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "manager" TEXT NOT NULL,
    "credentialSource" TEXT NOT NULL DEFAULT 'Michigan MILARA',
    "credentialType" TEXT NOT NULL DEFAULT 'Registered Nurse',
    "licenseNumber" TEXT,
    "credentialStatus" TEXT,
    "issueDate" TEXT,
    "expirationDate" TEXT,
    "county" TEXT,
    "verificationState" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "lastVerifiedAt" DATETIME,
    "lastAttemptAt" DATETIME,
    "verificationError" TEXT,
    "sourceUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VerificationAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "state" TEXT NOT NULL,
    "licenseNumber" TEXT,
    "status" TEXT,
    "expirationDate" TEXT,
    "normalizedJson" TEXT NOT NULL,
    "error" TEXT,
    "screenshotPath" TEXT,
    CONSTRAINT "VerificationAudit_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Employee_manager_idx" ON "Employee"("manager");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_sourceSheet_sourceRow_key" ON "Employee"("sourceSheet", "sourceRow");
