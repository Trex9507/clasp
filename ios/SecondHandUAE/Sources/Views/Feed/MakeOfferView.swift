import SwiftUI

struct MakeOfferView: View {
    let listing: Listing
    let onComplete: () async -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var amount = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(listing.title).font(.headline)
                    Text("Listed price: AED \(Int(listing.price))")
                        .foregroundStyle(.secondary)
                }

                Section("Your Offer") {
                    HStack {
                        Text("AED")
                        TextField("Amount", text: $amount)
                            .keyboardType(.numberPad)
                    }
                }

                if let errorMessage {
                    Section { Text(errorMessage).foregroundStyle(.red).font(.caption) }
                }

                Section {
                    Button("Send Offer") { submit() }
                        .disabled(amount.isEmpty || isSubmitting)
                        .frame(maxWidth: .infinity)
                }
            }
            .navigationTitle("Make an Offer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func submit() {
        guard let value = Double(amount), value > 0 else {
            errorMessage = "Enter a valid amount"
            return
        }
        isSubmitting = true
        Task {
            do {
                _ = try await APIClient.shared.createOffer(
                    CreateOfferRequest(listingId: listing.id, amount: value)
                )
                await onComplete()
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
            isSubmitting = false
        }
    }
}
