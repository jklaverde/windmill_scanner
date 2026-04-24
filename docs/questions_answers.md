37. POST uniqueness conflicts — HTTP code and inline field mapping  


Two creation endpoints can hit uniqueness violations:

- POST /farms — farm name must be unique (DB constraint)
- POST /windmills — windmill_id must be unique (DB constraint)  


When a duplicate is submitted, what HTTP code should the backend return, and which field should the frontend highlight with the inline error?

The current spec only defines 409 for blocked deletions (farm has windmills, windmill is running). Should uniqueness conflicts on creation also use 409, or a different code?

Proposed behaviour:

- 409 returned by backend with a descriptive message (e.g., "A farm with this name already exists." / "This windmill ID is already in use.")
- Frontend maps the 409 to the name field (farms form) or windmill_id field (windmill form) and displays it inline
- (a) Yes — use 409 for uniqueness conflicts; frontend maps to the relevant field inline
- (b) Use 422 instead (treat it like a validation error from FastAPI)
- (c) Something else

A:/ (a), and also report the error in the information windows, with a meaningful message like:
"The user is trying to create a farm with farm id that already exists"
