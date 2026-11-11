-- Remove exact active ITA duplicates, keeping the oldest row in each group.
WITH ranked_sales AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        user_id,
        person_id,
        sale_date,
        quantity,
        rate_per_thousand,
        sales_amount,
        note,
        week_start_date,
        week_end_date
      ORDER BY created_at ASC, id ASC
    ) AS duplicate_number
  FROM ita_sales
  WHERE is_deleted IS NOT TRUE
),
deleted_sales AS (
  DELETE FROM ita_sales AS sales
  USING ranked_sales
  WHERE sales.id = ranked_sales.id
    AND ranked_sales.duplicate_number > 1
  RETURNING sales.id
)
SELECT COUNT(*) AS duplicate_sales_removed FROM deleted_sales;

WITH ranked_payments AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        user_id,
        person_id,
        payment_date,
        amount,
        week_start_date,
        week_end_date,
        note
      ORDER BY created_at ASC, id ASC
    ) AS duplicate_number
  FROM ita_payments
  WHERE is_deleted IS NOT TRUE
),
deleted_payments AS (
  DELETE FROM ita_payments AS payments
  USING ranked_payments
  WHERE payments.id = ranked_payments.id
    AND ranked_payments.duplicate_number > 1
  RETURNING payments.id
)
SELECT COUNT(*) AS duplicate_payments_removed FROM deleted_payments;
