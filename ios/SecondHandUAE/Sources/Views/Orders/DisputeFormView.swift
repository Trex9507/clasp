import SwiftUI

struct DisputeFormView: View {
    let orderId: String
    let onComplete: () async -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var reason = "not_as_described"
    @State private var description = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    let reasons = [
        ("not_authentic", "Not Authentic"),
        ("not_as_described", "Not as Described"),
        ("damaged", "Damaged"),
        ("not_received", "Not Received"),
        ("other", "Other"),
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section("Reason") {
                    Picker("Reason", selection: $reason) {
                        ForEach(reasons, id: \.0) { r in
                            Text(r.1).tag(r.0)
                        }
                    }
                    .pickerStyle(.inline)
                }

                Section("Details") {
                    TextField("Describe the issue...", text: $description, axis: .vertical)
                        .lineLimit(3...8)
                }

                if let errorMessage {
                    Section { Text(errorMessage).foregroundStyle(.red).font(.caption) }
                }

                Section {
                    Button("Submit Dispute") { submit() }
                        .disabled(isSubmitting)
                        .frame(maxWidth: .infinity)
                }
            }
            .navigationTitle("Open Dispute")
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
                _ = try await APIClient.shared.createDispute(
                    CreateDisputeRequest(orderId: orderId, reason: reason, description: description.isEmpty ? nil : description)
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
