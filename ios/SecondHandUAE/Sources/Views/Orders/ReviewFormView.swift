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
            VStack(spacing: 24) {
                VStack(spacing: 12) {
                    Text("How was your experience?")
                        .font(.title3.bold())

                    HStack(spacing: 12) {
                        ForEach(1...5, id: \.self) { star in
                            Image(systemName: star <= rating ? "star.fill" : "star")
                                .font(.system(size: 36))
                                .foregroundStyle(star <= rating ? .yellow : Color(.systemGray4))
                                .onTapGesture { withAnimation(.easeInOut(duration: 0.15)) { rating = star } }
                        }
                    }
                    .padding(.vertical, 8)

                    Text(ratingLabel)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 20)

                VStack(alignment: .leading, spacing: 6) {
                    Text("Comment (optional)")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                    TextField("Share your thoughts...", text: $comment, axis: .vertical)
                        .lineLimit(3...6)
                        .padding(14)
                        .background(Color(.tertiarySystemFill))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }

                if let errorMessage {
                    Text(errorMessage).font(.caption).foregroundStyle(.red)
                }

                Spacer()

                Button("Submit Review") { submit() }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(isSubmitting)
            }
            .padding(24)
            .navigationTitle("Leave a Review")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private var ratingLabel: String {
        switch rating {
        case 1: return "Terrible"
        case 2: return "Poor"
        case 3: return "Okay"
        case 4: return "Good"
        case 5: return "Excellent"
        default: return ""
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
