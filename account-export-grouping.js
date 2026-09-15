/**
 * account-export-grouping.js — Account-Centric Export Grouping Layer
 *
 * Responsibilities:
 *   1. Group normalized transactions by accountNumber
 *   2. Merge duplicate account datasets from multiple source files
 *   3. Build account-level source file metadata
 *   4. Validate no cross-account contamination
 *   5. Build export preview data for the UI preview table
 *
 * Public API:
 *   AccountExportGrouping.group(transactions, uploadedFiles) → { [accId]: GroupEntry }
 *   AccountExportGrouping.validate(groups)                   → { valid, errors }
 *   AccountExportGrouping.buildPreview(groups, accountScores) → PreviewRow[]
 */

const AccountExportGrouping = (() => {
  'use strict';

  /**
   * Groups transactions by accountNumber.
   * Transactions from the same account across different files are merged into
   * one group — this satisfies RULES 3, 4, and 5.
   *
   * @param {Array}  transactions  - normalized + scored transactions
   * @param {Array}  uploadedFiles - [{ name, bankName, importedAt }]
   * @returns {Object} { [accId]: { accountNumber, transactions, sourceFiles, txCount } }
   */
  function group(transactions, uploadedFiles) {
    const byAccount = {};

    for (const tx of transactions) {
      const accId = (tx.accountNumber || '').trim() || 'UNKNOWN';
      if (!byAccount[accId]) byAccount[accId] = [];
      byAccount[accId].push(tx);
    }

    const result = {};

    for (const [accId, txs] of Object.entries(byAccount)) {
      // Collect unique source files referenced by this account's transactions.
      // tx.sourceFilename is stamped by flaProcessFiles() before the pipeline runs.
      // tx.rawSource is the bankName — used as fallback for demo/manual data.
      const seenFn  = new Set();
      const sourceFiles = [];

      for (const tx of txs) {
        const fn = tx.sourceFilename || tx.rawSource || '';
        if (!fn || seenFn.has(fn)) continue;
        seenFn.add(fn);

        // Resolve full file info from uploadedFiles list
        const fileInfo = (uploadedFiles || []).find(
          f => f.name === fn || f.bankName === fn
        );
        sourceFiles.push({
          filename:   fileInfo?.name    || fn,
          bankName:   fileInfo?.bankName || tx.bankName || tx.bank || '',
          importedAt: fileInfo?.importedAt || new Date().toISOString(),
        });
      }

      // Demo / manual fallback: if no source file could be resolved, list all
      // uploaded files so the Source Files sheet is never empty.
      if (sourceFiles.length === 0 && (uploadedFiles || []).length > 0) {
        for (const f of uploadedFiles) {
          sourceFiles.push({
            filename:   f.name,
            bankName:   f.bankName,
            importedAt: f.importedAt || new Date().toISOString(),
          });
        }
      }

      result[accId] = {
        accountNumber: accId,
        transactions:  txs,
        sourceFiles,
        txCount:       txs.length,
      };
    }

    return result;
  }

  /**
   * Validates that each group contains ONLY transactions belonging to its own
   * account number. Aborts export if contamination is detected.
   *
   * @param {Object} groups
   * @returns {{ valid: boolean, errors: string[] }}
   */
  function validate(groups) {
    const errors = [];

    for (const [accId, entry] of Object.entries(groups)) {
      const contaminated = entry.transactions.filter(t => {
        const txAcc = (t.accountNumber || '').trim() || 'UNKNOWN';
        return txAcc !== accId;
      });
      if (contaminated.length > 0) {
        errors.push(
          `TK ${accId}: ${contaminated.length} GD nhiễm từ tài khoản khác.`
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Builds the list of rows shown in the export preview table.
   * Sorted by fraud score descending (highest risk first).
   *
   * @param {Object} groups
   * @param {Object} accountScores - calibrated account scores map
   * @returns {Array<PreviewRow>}
   */
  function buildPreview(groups, accountScores) {
    return Object.entries(groups)
      .map(([accId, entry]) => {
        const score = (accountScores || {})[accId];
        return {
          accountNumber: accId,
          txCount:       entry.txCount,
          fraudScore:    score?.score    ?? null,
          riskLevel:     score?.riskLevel ?? '—',
          sourceCount:   entry.sourceFiles.length,
          bankName:
            entry.transactions[0]?.bankName ||
            entry.transactions[0]?.bank    || '—',
        };
      })
      .sort((a, b) => (b.fraudScore ?? -1) - (a.fraudScore ?? -1));
  }

  return { group, validate, buildPreview };
})();
