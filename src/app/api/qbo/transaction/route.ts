import { NextResponse } from 'next/server';
import { qboClient } from '@/lib/qbo';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const body = await request.json();
        const { transactions, bankAccountId, companyId } = body;

        // Basic validation
        if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
            return NextResponse.json({ error: 'No transactions provided' }, { status: 400 });
        }

        const results = [];
        const errors = [];

        // 1. Determine Primary Bank Account

        let primaryBankId = bankAccountId;
        let primaryBankName = "";

        if (primaryBankId) {
            // Optimally we should just fetch this specific account to get name, or rely on frontend passing name too.
            // But let's fetch all banks and find it to be safe and get the Name.
            const accountsData = await qboClient.getBankAccounts(supabase, companyId);
            const allBankAccounts = accountsData.QueryResponse?.Account || accountsData || [];
            const selectedAcc = allBankAccounts.find((a: any) => a.Id === primaryBankId);

            if (selectedAcc) {
                primaryBankName = selectedAcc.Name;
            } else {
                return NextResponse.json({ error: 'Selected Bank Account not found in QBO.' }, { status: 400 });
            }
        } else {
            // Fallback
            const accountsData = await qboClient.getBankAccounts(supabase, companyId);
            const allBankAccounts = accountsData.QueryResponse?.Account || accountsData || [];
            const primaryBankAccount = allBankAccounts[0];
            if (!primaryBankAccount) {
                return NextResponse.json({ error: 'No Bank Account found in QBO to use as default offset.' }, { status: 400 });
            }
            primaryBankId = primaryBankAccount.Id;
            primaryBankName = primaryBankAccount.Name;
        }

        let successCount = 0;

        for (const txn of transactions) {
            try {
                // 2. Prepare Data
                const amount = Math.abs(parseFloat(txn.Amount || txn.amount || 0));
                const description = txn.Description || txn.description || 'Bank Upload';

                // Helper to safely parse date
                const parseDate = (d: any) => {
                    if (!d) return new Date().toISOString().split('T')[0];
                    if (d instanceof Date) return d.toISOString().split('T')[0];

                    const parsed = new Date(d);
                    if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];

                    if (typeof d === 'string' && d.includes('/')) {
                        const parts = d.split('/');
                        if (parts.length === 3) {
                            const day = parseInt(parts[0]);
                            const month = parseInt(parts[1]);
                            const year = parseInt(parts[2]);
                            if (year > 1000) {
                                return new Date(year, month - 1, day).toISOString().split('T')[0];
                            }
                        }
                    }
                    console.warn(`Could not parse date: ${d}, defaulting to today`);
                    return new Date().toISOString().split('T')[0];
                };

                const txnDate = parseDate(txn.Date || txn.date);
                const type = txn.transaction_type || (parseFloat(txn.Amount || txn.amount || 0) > 0 ? 'Income' : 'Expense');
                const targetAccountId = txn.qbo_account_id;

                if (!targetAccountId) {
                    throw new Error(`Missing Target Account for transaction: ${description}`);
                }

                // 3. Post based on Type
                let result;

                if (type === 'Expense') {
                    // Create Purchase (Cash Expense)
                    const purchaseData = {
                        TxnDate: txnDate,
                        PaymentType: "Cash", // or Check if 'Check' type
                        AccountRef: {
                            value: primaryBankId,
                            name: primaryBankName
                        },
                        Line: [
                            {
                                DetailType: "AccountBasedExpenseLineDetail",
                                Amount: amount,
                                Description: description,
                                AccountBasedExpenseLineDetail: {
                                    AccountRef: {
                                        value: targetAccountId
                                    },
                                    // Add Customer/Project ref if needed (CustomerRef is for billable status usually)
                                }
                            }
                        ]
                    };

                    // Add Vendor Ref
                    if (txn.qbo_vendor_id) {
                        (purchaseData as any).EntityRef = {
                            value: txn.qbo_vendor_id,
                            type: "Vendor"
                        };
                    }

                    result = await qboClient.createPurchase(supabase, purchaseData, companyId);
                    results.push({ id: result.Purchase?.Id || result.Id, status: 'success', type: 'Purchase' });

                } else if (type === 'Income') {
                    // Create Deposit
                    const depositData = {
                        TxnDate: txnDate,
                        DepositToAccountRef: {
                            value: primaryBankId,
                            name: primaryBankName
                        },
                        Line: [
                            {
                                DetailType: "DepositLineDetail",
                                Amount: amount,
                                Description: description,
                                DepositLineDetail: {
                                    AccountRef: {
                                        value: targetAccountId
                                    },
                                    Entity: txn.qbo_customer_id ? {
                                        value: txn.qbo_customer_id,
                                        type: "Customer"
                                    } : undefined
                                }
                            }
                        ]
                    };
                    result = await qboClient.createDeposit(supabase, depositData, companyId);
                    results.push({ id: result.Deposit?.Id || result.Id, status: 'success', type: 'Deposit' });

                } else if (type === 'Transfer') {
                    // Create Transfer
                    const transferData = {
                        TxnDate: txnDate,
                        FromAccountRef: {
                            value: primaryBankId,
                            name: primaryBankName
                        },
                        ToAccountRef: {
                            value: targetAccountId
                        },
                        Amount: amount,
                        PrivateNote: description
                    };

                    // If money IN (Positive), swap from/to
                    if (parseFloat(txn.Amount || txn.amount || 0) > 0) {
                        transferData.FromAccountRef = { value: targetAccountId } as any;
                        transferData.ToAccountRef = { value: primaryBankId } as any;
                    }

                    result = await qboClient.createTransfer(supabase, transferData, companyId);
                    results.push({ id: result.Transfer?.Id || result.Id, status: 'success', type: 'Transfer' });

                } else {
                    // Fallback to Journal Entry if unknown type
                    throw new Error(`Unsupported Transaction Type: ${type}`);
                }

                successCount++;

            } catch (err: any) {
                console.error("Row Error:", err);
                errors.push({ txn, error: err.message || err.Fault?.Error?.[0]?.Message });
            }
        }

        return NextResponse.json({
            message: 'Processing complete',
            successCount,
            errorCount: errors.length,
            errors
        });

    } catch (error) {
        console.error('Transaction Post Error:', error);
        return NextResponse.json({ error: 'Failed to post transactions' }, { status: 500 });
    }
}
