window.TRACEPROV_PORTAL_CONFIG = {
  // In Google Forms, use "Send" -> link icon and replace viewform with formResponse.
  googleFormResponseUrl: "https://docs.google.com/forms/d/e/REPLACE_FORM_ID/formResponse",
  // Replace these four values with the entry.<number> names from your Google Form.
  googleFormFields: {
    reviewer: "entry.REPLACE_REVIEWER_FIELD",
    case: "entry.REPLACE_CASE_FIELD",
    submittedAt: "entry.REPLACE_TIMESTAMP_FIELD",
    annotationJson: "entry.REPLACE_ANNOTATION_FIELD"
  }
};
