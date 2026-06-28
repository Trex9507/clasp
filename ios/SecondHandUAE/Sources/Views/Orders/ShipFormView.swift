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
            Form {
                Section("Tracking Number (optional)") {
                    TextField("e.g. TRACK123456", text: $trackingNumber)
                        .autocapitalization(.allCharacters)
                }

                Section {
                    Text("If using a courier, enter the tracking number. For hand-off, you can leave this empty.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                if let errorMessage {
                    Section { Text(errorMessage).foregroundStyle(.red).font(.caption) }
                }

                Section {
                    Button("Confirm Shipment") { submit() }
                        .disabled(isSubmitting)
                        .frame(maxWidth: .infinity)
                }
            }
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
