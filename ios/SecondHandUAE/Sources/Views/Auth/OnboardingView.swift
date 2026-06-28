import SwiftUI

struct OnboardingView: View {
    @State private var animateIn = false

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(
                    colors: [Color(red: 0.97, green: 0.96, blue: 0.94), Color(.systemBackground)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()

                VStack(spacing: 0) {
                    Spacer()

                    VStack(spacing: 16) {
                        ZStack {
                            Circle()
                                .fill(Color.accentColor.opacity(0.08))
                                .frame(width: 120, height: 120)
                            Image(systemName: "hanger")
                                .font(.system(size: 48, weight: .light))
                                .foregroundStyle(.primary)
                        }
                        .scaleEffect(animateIn ? 1 : 0.8)
                        .opacity(animateIn ? 1 : 0)

                        VStack(spacing: 6) {
                            Text("SecondHand")
                                .font(.system(size: 32, weight: .bold, design: .default))
                                .tracking(-0.5)
                            Text("UAE")
                                .font(.system(size: 32, weight: .light, design: .default))
                                .tracking(6)
                                .foregroundStyle(.secondary)
                        }
                        .opacity(animateIn ? 1 : 0)

                        Text("Buy & sell pre-loved fashion\nin Dubai & Abu Dhabi")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.top, 4)
                            .opacity(animateIn ? 1 : 0)
                    }

                    Spacer()

                    // Features
                    VStack(spacing: 14) {
                        featureRow(icon: "checkmark.seal.fill", color: .blue, title: "Verified Listings", subtitle: "Trust through seller-declared verification")
                        featureRow(icon: "lock.shield.fill", color: .green, title: "Secure Payments", subtitle: "Escrow-protected transactions")
                        featureRow(icon: "location.fill", color: .orange, title: "Local Community", subtitle: "Dubai & Abu Dhabi sellers")
                    }
                    .padding(.horizontal, 24)
                    .offset(y: animateIn ? 0 : 20)
                    .opacity(animateIn ? 1 : 0)

                    Spacer()

                    VStack(spacing: 12) {
                        NavigationLink(destination: RegisterView()) {
                            Text("Get Started")
                                .fontWeight(.semibold)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 16)
                                .background(Color.primary)
                                .foregroundStyle(Color(.systemBackground))
                                .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius))
                        }

                        NavigationLink(destination: LoginView()) {
                            Text("I already have an account")
                                .fontWeight(.medium)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 16)
                                .foregroundStyle(.primary)
                        }
                    }
                    .padding(.horizontal, 24)
                    .padding(.bottom, 16)
                }
            }
            .onAppear {
                withAnimation(.easeOut(duration: 0.7)) { animateIn = true }
            }
        }
    }

    private func featureRow(icon: String, color: Color, title: String, subtitle: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.body)
                .foregroundStyle(color)
                .frame(width: 36, height: 36)
                .background(color.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(.subheadline.bold())
                Text(subtitle).font(.caption).foregroundStyle(.secondary)
            }

            Spacer()
        }
    }
}
