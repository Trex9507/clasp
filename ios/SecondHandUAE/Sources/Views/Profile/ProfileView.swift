import SwiftUI

struct ProfileView: View {
    @AppStorage("isLoggedIn") private var isLoggedIn = false
    @AppStorage("userId") private var userId = ""

    @State private var user: User?
    @State private var reviews: [Review] = []
    @State private var isLoading = true
    @State private var showLogoutConfirm = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Profile header
                    if let user {
                        VStack(spacing: 14) {
                            AvatarView(url: user.profilePhotoUrl, size: 80)

                            VStack(spacing: 4) {
                                Text(user.name)
                                    .font(.title2.bold())
                                HStack(spacing: 4) {
                                    Image(systemName: "mappin")
                                    Text(user.city.replacingOccurrences(of: "_", with: " ").capitalized)
                                }
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            }

                            if let avg = user.ratingAvg, let count = user.ratingCount, count > 0 {
                                HStack(spacing: 6) {
                                    HStack(spacing: 2) {
                                        ForEach(1...5, id: \.self) { star in
                                            Image(systemName: Double(star) <= (avg + 0.25) ? "star.fill" : Double(star) <= (avg + 0.75) ? "star.leadinghalf.filled" : "star")
                                                .font(.caption)
                                                .foregroundStyle(.yellow)
                                        }
                                    }
                                    Text(String(format: "%.1f", avg))
                                        .font(.subheadline.bold())
                                    Text("(\(count))")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 24)
                        .padding(.horizontal)
                        .background(Color(.secondarySystemGroupedBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 16))

                        // Stats row
                        HStack(spacing: 0) {
                            statItem(value: "\(user.ratingCount ?? 0)", label: "Reviews")
                            Divider().frame(height: 30)
                            statItem(value: user.city.replacingOccurrences(of: "_", with: " ").capitalized, label: "Location")
                        }
                        .padding(16)
                        .background(Color(.secondarySystemGroupedBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    }

                    // Reviews
                    if !reviews.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Reviews")
                                .font(.headline)
                                .padding(.horizontal, 4)

                            ForEach(reviews) { review in
                                VStack(alignment: .leading, spacing: 8) {
                                    HStack {
                                        HStack(spacing: 2) {
                                            ForEach(1...5, id: \.self) { star in
                                                Image(systemName: star <= review.rating ? "star.fill" : "star")
                                                    .font(.caption2)
                                                    .foregroundStyle(star <= review.rating ? .yellow : Color(.systemGray4))
                                            }
                                        }
                                        Spacer()
                                        Text(review.reviewer?.name ?? "User")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                    if let comment = review.comment, !comment.isEmpty {
                                        Text(comment)
                                            .font(.subheadline)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                .padding(14)
                                .background(Color(.secondarySystemGroupedBackground))
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                            }
                        }
                    }

                    // Log out
                    Button(role: .destructive) {
                        showLogoutConfirm = true
                    } label: {
                        HStack {
                            Image(systemName: "rectangle.portrait.and.arrow.right")
                            Text("Log Out")
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                    }
                    .buttonStyle(SecondaryButtonStyle())
                    .padding(.top, 8)
                }
                .padding(16)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Profile")
            .task { await loadProfile() }
            .refreshable { await loadProfile() }
            .confirmationDialog("Log Out", isPresented: $showLogoutConfirm) {
                Button("Log Out", role: .destructive) {
                    APIClient.shared.logout()
                    userId = ""
                    isLoggedIn = false
                }
            } message: {
                Text("Are you sure you want to log out?")
            }
        }
    }

    private func statItem(value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.subheadline.bold())
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
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
