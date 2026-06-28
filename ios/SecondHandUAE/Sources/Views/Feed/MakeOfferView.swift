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
            VStack(spacing: 24) {
                // Item preview
                HStack(spacing: 14) {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Color(.systemGray6))
                        .frame(width: 64, height: 64)
                        .overlay {
                            if let photo = listing.photos?.first {
                                AsyncImage(url: URL(string: photo.url)) { image in
                                    image.resizable().scaledToFill()
                                } placeholder: {
                                    Color(.systemGray5)
                                }
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                            }
                        }

                    VStack(alignment: .leading, spacing: 4) {
                        Text(listing.title).font(.subheadline.bold()).lineLimit(1)
                        Text("Listed at AED \(Int(listing.price))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                }
                .padding(16)
                .background(Color(.tertiarySystemFill))
                .clipShape(RoundedRectangle(cornerRadius: 14))

                // Offer input
                VStack(spacing: 8) {
                    Text("Your Offer")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    HStack(spacing: 8) {
                        Text("AED")
                            .font(.title3.weight(.medium))
                            .foregroundStyle(.secondary)
                        TextField("0", text: $amount)
                            .font(.system(size: 36, weight: .bold, design: .rounded))
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.leading)
                    }
                    .padding(16)
                    .background(Color(.tertiarySystemFill))
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(.red)
                }

                Spacer()

                Button("Send Offer") { submit() }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(amount.isEmpty || isSubmitting)
            }
            .padding(24)
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
