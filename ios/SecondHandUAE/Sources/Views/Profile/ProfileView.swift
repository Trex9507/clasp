import SwiftUI

struct ProfileView: View {
    @AppStorage("isLoggedIn") private var isLoggedIn = false
    @AppStorage("userId") private var userId = ""

    @State private var user: User?
    @State private var reviews: [Review] = []
    @State private var isLoading = true

    var body: some View {
        NavigationStack {
            List {
                if let user {
                    Section {
                        HStack(spacing: 12) {
                            Image(systemName: "person.circle.fill")
                                .font(.system(size: 48))
                                .foregroundStyle(.secondary)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(user.name).font(.title3.bold())
                                Text(user.city.replacingOccurrences(of: "_", with: " ").capitalized)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                if let avg = user.ratingAvg, let count = user.ratingCount, count > 0 {
                                    HStack(spacing: 4) {
                                        Image(systemName: "star.fill").foregroundStyle(.yellow)
                                        Text(String(format: "%.1f", avg))
                                        Text("(\(count) reviews)")
                                            .foregroundStyle(.secondary)
                                    }
                                    .font(.caption)
                                }
                            }
                        }
                        .padding(.vertical, 4)
                    }

                    if !reviews.isEmpty {
                        Section("Reviews") {
                            ForEach(reviews) { review in
                                VStack(alignment: .leading, spacing: 4) {
                                    HStack {
                                        HStack(spacing: 2) {
                                            ForEach(1...5, id: \.self) { star in
                                                Image(systemName: star <= review.rating ? "star.fill" : "star")
                                                    .font(.caption2)
                                                    .foregroundStyle(star <= review.rating ? .yellow : .gray)
                                            }
                                        }
                                        Spacer()
                                        Text(review.reviewer?.name ?? "User")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                    if let comment = review.comment {
                                        Text(comment)
                                            .font(.subheadline)
                                    }
                                }
                                .padding(.vertical, 2)
                            }
                        }
                    }
                }

                Section {
                    Button("Log Out", role: .destructive) {
                        APIClient.shared.logout()
                        userId = ""
                        isLoggedIn = false
                    }
                }
            }
            .navigationTitle("Profile")
            .task { await loadProfile() }
            .refreshable { await loadProfile() }
        }
    }

    private func loadProfile() async {
        do {
            user = try await APIClient.shared.getMyProfile()
            if !userId.isEmpty {
                reviews = try await APIClient.shared.getReviewsForUser(userId: userId)
            }
        } catch {}
        isLoading = false
    }
}
