import SwiftUI

struct DisputeFormView: View {
    let orderId: String
    let onComplete: () async -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var reason = "not_as_described"
    @State private var description = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    let reasons: [(String, String, String)] = [
        ("not_authentic", "Not Authentic", "exclamationmark.shield"),
        ("not_as_described", "Not as Described", "text.badge.xmark"),
        ("damaged", "Damaged", "bandage"),
        ("not_received", "Not Received", "shippingbox.and.arrow.backward"),
        ("other", "Other", "ellipsis.circle"),
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    VStack(spacing: 6) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.system(size: 32))
                            .foregroundStyle(.orange)
                        Text("Open a Dispute")
                            .font(.title3.bold())
                        Text("The seller will have 24 hours to respond")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 16)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Reason").font(.caption.bold()).foregroundStyle(.secondary)

                        ForEach(reasons, id: \.0) { r in
                            Button {
                                reason = r.0
                            } label: {
                                HStack(spacing: 12) {
                                    Image(systemName: r.2)
                                        .frame(width: 24)
                                        .foregroundStyle(reason == r.0 ? .accentColor : .secondary)
                                    Text(r.1)
                                        .font(.subheadline)
                                        .foregroundStyle(.primary)
                                    Spacer()
                                    Image(systemName: reason == r.0 ? "checkmark.circle.fill" : "circle")
                                        .foregroundStyle(reason == r.0 ? .accentColor : Color(.systemGray4))
                                }
                                .padding(14)
                                .background(reason == r.0 ? Color.accentColor.opacity(0.05) : Color(.tertiarySystemFill))
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .strokeBorder(reason == r.0 ? Color.accentColor.opacity(0.3) : .clear, lineWidth: 1)
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Details").font(.caption.bold()).foregroundStyle(.secondary)
                        TextField("Describe the issue...", text: $description, axis: .vertical)
                            .lineLimit(3...8)
                            .padding(14)
                            .background(Color(.tertiarySystemFill))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }

                    if let errorMessage {
                        Text(errorMessage).font(.caption).foregroundStyle(.red)
                    }

                    Button("Submit Dispute") { submit() }
                        .buttonStyle(PrimaryButtonStyle())
                        .disabled(isSubmitting)
                        .padding(.top, 8)
                }
                .padding(24)
            }
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
