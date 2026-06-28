import SwiftUI

enum Theme {
    static let accent = Color("AccentColor")
    static let cardBackground = Color(.secondarySystemGroupedBackground)
    static let subtleBackground = Color(.systemGroupedBackground)

    static let cornerRadius: CGFloat = 14
    static let cardCornerRadius: CGFloat = 12

    static let gradientTop = Color(red: 0.12, green: 0.12, blue: 0.14)
    static let gradientBottom = Color(red: 0.06, green: 0.06, blue: 0.08)
}

struct PrimaryButtonStyle: ButtonStyle {
    var isWide = true

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .fontWeight(.semibold)
            .frame(maxWidth: isWide ? .infinity : nil)
            .padding(.vertical, 14)
            .padding(.horizontal, isWide ? 0 : 24)
            .background(Color.accentColor)
            .foregroundStyle(.white)
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius))
            .opacity(configuration.isPressed ? 0.85 : 1)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeInOut(duration: 0.15), value: configuration.isPressed)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .fontWeight(.medium)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Color(.tertiarySystemFill))
            .foregroundStyle(.primary)
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius))
            .opacity(configuration.isPressed ? 0.8 : 1)
    }
}

struct VerifiedBadge: View {
    var size: Font = .caption2

    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: "checkmark.seal.fill")
            Text("Verified")
        }
        .font(size)
        .fontWeight(.medium)
        .foregroundStyle(.white)
        .padding(.horizontal, 7)
        .padding(.vertical, 3)
        .background(.blue.gradient)
        .clipShape(Capsule())
    }
}

struct PriceTag: View {
    let amount: Double
    var font: Font = .subheadline

    var body: some View {
        Text("AED \(Int(amount))")
            .font(font.bold())
    }
}

struct StatusPill: View {
    let label: String
    let color: Color

    var body: some View {
        Text(label)
            .font(.caption2.bold())
            .textCase(.uppercase)
            .foregroundStyle(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.12))
            .clipShape(Capsule())
    }
}

struct AvatarView: View {
    let url: String?
    var size: CGFloat = 40

    var body: some View {
        Group {
            if let url, let imgUrl = URL(string: url) {
                AsyncImage(url: imgUrl) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    placeholder
                }
            } else {
                placeholder
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }

    private var placeholder: some View {
        Circle()
            .fill(Color(.tertiarySystemFill))
            .overlay {
                Image(systemName: "person.fill")
                    .font(.system(size: size * 0.4))
                    .foregroundStyle(.secondary)
            }
    }
}

struct ListingImageView: View {
    let url: String?
    var cornerRadius: CGFloat = Theme.cardCornerRadius

    var body: some View {
        Group {
            if let url, let imgUrl = URL(string: url) {
                AsyncImage(url: imgUrl) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    case .failure:
                        imagePlaceholder
                    default:
                        ProgressView()
                    }
                }
            } else {
                imagePlaceholder
            }
        }
    }

    private var imagePlaceholder: some View {
        Color(.systemGray5)
            .overlay {
                Image(systemName: "photo")
                    .font(.title2)
                    .foregroundStyle(.quaternary)
            }
    }
}
