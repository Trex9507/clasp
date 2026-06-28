import SwiftUI

struct ShipFormView: View {
    let orderId: String
    let onComplete: () async -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var trackingNumber = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                VStack(spacing: 12) {
                    Image(systemName: "shippingbox.fill")
                        .font(.system(size: 40))
                        .foregroundStyle(.blue)
                    Text("Ship this order")
                        .font(.title3.bold())
                    Text("If using a courier, enter the tracking number.\nFor hand-off, you can skip this.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.top, 20)

                VStack(alignment: .leading, spacing: 6) {
                    Text("Tracking Number (optional)")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                    TextField("e.g. TRACK123456", text: $trackingNumber)
                        .autocapitalization(.allCharacters)
                        .padding(14)
                        .background(Color(.tertiarySystemFill))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }

                if let errorMessage {
                    Text(errorMessage).font(.caption).foregroundStyle(.red)
                }

                Spacer()

                Button("Confirm Shipment") { submit() }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(isSubmitting)
            }
            .padding(24)
            .navigationTitle("Ship Order")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func submit() {
        isSubmitting = true
        Task {
            do {
                _ = try await APIClient.shared.shipOrder(id: orderId, trackingNumber: trackingNumber.isEmpty ? nil : trackingNumber)
                await onComplete()
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
            isSubmitting = false
        }
    }
}
