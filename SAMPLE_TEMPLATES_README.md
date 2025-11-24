# Sample Contract Templates

These are test templates you can use to populate your database and test the application.

## Available Templates

### 1. `sample-nda-template.txt`
**Type:** Non-Disclosure Agreement (NDA)
**Category:** Legal
**Description:** Mutual NDA template for two-party confidentiality agreements

**Use Case:** Protecting confidential information shared between two parties exploring a business opportunity.

---

### 2. `sample-employment-contract.txt`
**Type:** Employment Contract
**Category:** HR / Employment
**Description:** Standard employment agreement with comprehensive terms

**Use Case:** Hiring full-time employees with detailed terms covering compensation, benefits, confidentiality, and termination.

---

### 3. `sample-freelance-contract.txt`
**Type:** Independent Contractor Agreement
**Category:** Freelance / Consulting
**Description:** Freelance/consulting services agreement with IP assignment

**Use Case:** Engaging freelancers or consultants for project-based work with clear deliverables and payment terms.

---

### 4. `sample-loan-agreement.txt`
**Type:** Loan Agreement
**Category:** Financial / Lending
**Description:** Comprehensive loan agreement with payment terms, security, and default provisions

**Use Case:** Formalizing personal or business loans with clear repayment terms, interest rates, and collateral requirements.

---

## How to Upload Templates

### Step 1: Make Sure Database is Set Up
First, ensure you've run the migration SQL (see `QUICKSTART.md`):
```bash
npm run db:verify
```

### Step 2: Start the Server
```bash
npm run dev
```

### Step 3: Upload via Frontend
1. Open your application in the browser (usually `http://localhost:5000`)
2. Navigate to the Templates section
3. Click "Upload Template" or "Add Template"
4. Fill in the form:
   - **Title**: (e.g., "Mutual Non-Disclosure Agreement")
   - **Category**: (e.g., "Legal")
   - **Description**: Brief description of the template
   - **File**: Select one of the `.txt` files
5. Click "Upload" or "Submit"

### Step 4: Verify Upload
- Check the templates list in your application
- The template should appear with an ID
- Embeddings should be generated automatically

## Template Categories

Suggested categories for organizing templates:
- `Legal` - NDAs, general legal agreements
- `Employment` - Employment contracts, offer letters
- `Freelance` - Contractor agreements, consulting contracts
- `Financial` - Loan agreements, promissory notes, investment agreements
- `Services` - Service agreements, SLAs
- `Sales` - Sales contracts, purchase agreements
- `Real Estate` - Lease agreements, property contracts
- `Partnership` - Partnership agreements, joint ventures

## Customizing Templates

These templates contain placeholders in `[BRACKETS]` that can be replaced with actual values:

- `[DATE]` - Contract date
- `[COMPANY_NAME]` - Company name
- `[EMPLOYEE_NAME]` - Employee name
- `[AMOUNT]` - Dollar amounts
- `[DURATION]` - Time periods
- `[JURISDICTION]` - Legal jurisdiction
- etc.

Your application can extract these placeholders and prompt users to fill them in when generating contracts.

## Testing RAG/Vector Search

After uploading these templates, you can test the vector search functionality:

1. **Test Query Examples:**
   - "Find me a confidentiality agreement"
   - "I need a contract for hiring someone"
   - "Show me freelance agreements"
   - "What templates cover intellectual property?"

2. **Expected Results:**
   - The system should return relevant templates based on semantic similarity
   - NDA should match queries about confidentiality
   - Employment contract should match queries about hiring
   - Freelance contract should match queries about contractors

## Template Metadata

Each template when uploaded should store:
- **ID**: Unique identifier
- **Title**: Template name
- **Category**: Template category
- **Description**: Brief description
- **Content**: Full template text
- **Embedding**: Vector embedding for search
- **Usage Count**: How many times it's been used
- **Created At**: Upload timestamp

## Next Steps

1. ✅ Upload these sample templates
2. ✅ Test template search and retrieval
3. ✅ Test vector/semantic search
4. ✅ Generate contracts from templates
5. ✅ Test validation features

## Creating More Templates

Need more templates? You can:
1. Create your own `.txt` files
2. Find templates online (make sure they're legally sound)
3. Ask me to generate specific template types
4. Customize these templates for your needs

## Questions?

See the main documentation:
- `QUICKSTART.md` - Quick setup guide
- `DATABASE_SETUP.md` - Detailed database setup
- `README.md` - General project documentation
