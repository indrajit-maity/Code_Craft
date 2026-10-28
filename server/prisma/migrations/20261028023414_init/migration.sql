/*
  Warnings:

  - The primary key for the `refresh_tokens` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `refresh_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `expiresAt` on the `refresh_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `familyId` on the `refresh_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `revokedAt` on the `refresh_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `tokenHash` on the `refresh_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `usedAt` on the `refresh_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `userAgent` on the `refresh_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `refresh_tokens` table. All the data in the column will be lost.
  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `passwordHash` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `users` table. All the data in the column will be lost.
  - The `roles` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[token_hash]` on the table `refresh_tokens` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `created_at` to the `refresh_tokens` table without a default value. This is not possible if the table is not empty.
  - Added the required column `expires_at` to the `refresh_tokens` table without a default value. This is not possible if the table is not empty.
  - Added the required column `family_id` to the `refresh_tokens` table without a default value. This is not possible if the table is not empty.
  - Added the required column `token_hash` to the `refresh_tokens` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `refresh_tokens` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id` on the `refresh_tokens` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `password_hash` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `users` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id` on the `users` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('user', 'moderator', 'admin');

-- DropForeignKey
ALTER TABLE "refresh_tokens" DROP CONSTRAINT "refresh_tokens_userId_fkey";

-- DropIndex
DROP INDEX "refresh_tokens_familyId_idx";

-- DropIndex
DROP INDEX "refresh_tokens_tokenHash_key";

-- DropIndex
DROP INDEX "refresh_tokens_userId_idx";

-- AlterTable
ALTER TABLE "refresh_tokens" DROP CONSTRAINT "refresh_tokens_pkey",
DROP COLUMN "createdAt",
DROP COLUMN "expiresAt",
DROP COLUMN "familyId",
DROP COLUMN "revokedAt",
DROP COLUMN "tokenHash",
DROP COLUMN "usedAt",
DROP COLUMN "userAgent",
DROP COLUMN "userId",
ADD COLUMN     "created_at" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "expires_at" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "family_id" UUID NOT NULL,
ADD COLUMN     "revoked_at" TIMESTAMPTZ(3),
ADD COLUMN     "token_hash" VARCHAR(64) NOT NULL,
ADD COLUMN     "used_at" TIMESTAMPTZ(3),
ADD COLUMN     "user_agent" VARCHAR(512),
ADD COLUMN     "user_id" UUID NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
DROP COLUMN "createdAt",
DROP COLUMN "passwordHash",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "password_hash" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMPTZ(3) NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "roles",
ADD COLUMN     "roles" "Role"[] DEFAULT ARRAY['user']::"Role"[],
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
