-------------------------------------------------------------------------------
-- This migration resets the "is_waitlisted" column for all users.
-- This mechanisms is used in star-search to determine people requesting access to the product.
-------------------------------------------------------------------------------

-- Sets all current users to be waitlisted to star-search
update users set is_waitlisted = false;

-- Set the OpenSauced internal team to be on the waitlist
update users set is_waitlisted = true where login in (
  'BekahHW',
  'bdougie',
  'brandonroberts',
  'chhristopher'
  'isabensusan'
  'jpmcb',
  'nickytonline',
  'zeucapua'
);
