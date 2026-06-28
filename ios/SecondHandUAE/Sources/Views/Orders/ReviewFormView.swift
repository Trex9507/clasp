import SwiftUI

struct ReviewFormView: View {
    let orderId: String
    let onComplete: () async -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var rating = 5
    @State private var comment = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Rating") {
                    HStack(spacing: 8) {
                        ForEach(1...5, id: \.self) { star in
                            Image(systemName: star <= rating ? "star.fill" : "star")
                                .font(.title2)
                                .foregroundStyle(star <= rating ? .yellow : .gray)
                                .onTapGesture { rating = star }
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                }

                Section("Comment (optional)") {
                    TextField("How was your experience?", text: $comment, axis: .vertical)
                        .lineLimit(3...6)
                }

                if let errorMessage {
                    Section { Text(errorMessage).foregroundStyle(.red).font(.caption) }
                }

                Section {
                    Button("Submit Review") { submit() }
                        .disabled(isSubmitting)
                        .frame(maxWidth: .infinity)
                }
            }
            .navigationTitle("Leave a Review")
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
                _ = try await APIClient.shared.createReview(
                    CreateReviewRequest(orderId: orderId, rating: rating, comment: comment.isEmpty ? nil : comment)
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
