import SwiftUI

struct OnboardingView: View {
    @State private var showRegister = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 32) {
                Spacer()

                VStack(spacing: 8) {
                    Image(systemName: "bag.fill")
                        .font(.system(size: 64))
                        .foregroundStyle(.tint)
                    Text("SecondHand UAE")
                        .font(.largeTitle.bold())
                    Text("Buy & sell pre-loved fashion in Dubai & Abu Dhabi")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }

                Spacer()

                VStack(spacing: 12) {
                    NavigationLink(destination: LoginView()) {
                        Text("Log In")
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(.tint)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }

                    NavigationLink(destination: RegisterView()) {
                        Text("Create Account")
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color(.systemGray5))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 32)
            }
        }
    }
}
