/*
  Warnings:

  - Added the required column `cost` to the `products` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."products" ADD COLUMN     "cost" DOUBLE PRECISION NOT NULL;
